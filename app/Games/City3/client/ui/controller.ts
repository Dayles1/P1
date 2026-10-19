/**
 * The interface's brain, outside React: it owns the stores (HUD snapshot,
 * interface state, feedback), runs the frame loop (simulation ticks, the
 * renderer, the 4 Hz HUD sample, the slower city scan), and carries out
 * every player action — tools (placement with paint, lines, bulldozer
 * with undo, move), selection with the focus rule, fixes, strips, speed
 * and settings. Components read the stores and call these methods.
 */

import type { AudioEngine } from '../audio/audio';
import type { Amounts, BuildingDef } from '../engine/content/types';
import type { GameEvent } from '../engine/core/events';
import type { Game } from '../engine/sim/game';
import { footprintDistance } from '../engine/sim/grids';
import type { Overlay, Quality, Renderer } from '../scene/renderer';
import { formatNumber, stripEmoji } from './format';
import { advise, scanHomes } from './game/advisor';
import type { AdvisorView, FixTarget, HomeScan } from './game/advisor';
import { isPaintable, isRepeatable, tabOf } from './game/catalog';
import type { Card, TabId } from './game/catalog';
import { buyStrip, landOffer, stripInfo } from './game/strips';
import type { Side } from './game/strips';
import { demolish, undoDemolition } from './game/undo';
import { t, word } from './i18n';
import { lPath } from './input/gestures';
import type { PanKey } from './input/keyboard';
import type { SaveSession } from './session';
import { FeedbackStore } from './store/feedback';
import { runFrame } from './store/frame';
import { HudStore } from './store/hud-store';
import { escape, openSheet, toggleSheet, UiStore } from './store/ui-store';
import type {
    GoalsTab,
    Layer,
    PopoverId,
    SheetId,
    Tile,
    Tool,
    UiState,
} from './store/ui-store';

export type Layout = 'portrait' | 'landscape' | 'desktop';

/** The three layouts of ui-spec §3.4, by the viewport. */
export function layoutOf(width: number, height: number): Layout {
    if (width >= 1024 && height >= 600) {
        return 'desktop';
    }

    return width > height && height <= 520 ? 'landscape' : 'portrait';
}

export type QualitySetting = Quality | 'auto';

const STORAGE = {
    quality: 'city3.quality',
    muted: 'city3.muted',
    hints: 'city3.hints',
    coach: 'city3.coach',
    seenStory: 'city3.seenStory',
};

function read(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage blocked: the choice lasts until the page closes.
    }
}

export function savedQuality(): QualitySetting {
    const value = read(STORAGE.quality);

    return value === 'low' || value === 'medium' || value === 'high'
        ? value
        : 'auto';
}

/** Auto quality: phones start at medium (v2 always ran high). */
function autoQuality(): Quality {
    return layoutOf(window.innerWidth, window.innerHeight) === 'desktop' &&
        !window.matchMedia?.('(pointer: coarse)').matches
        ? 'high'
        : 'medium';
}

export function qualityFor(setting: QualitySetting): Quality {
    return setting === 'auto' ? autoQuality() : setting;
}

/** A tile on a line being drawn and what laying it means. */
export interface LineTile {
    x: number;
    y: number;
    kind: 'new' | 'up' | 'same' | 'bad';
    /** Within the money (new and upgraded tiles only). */
    affordable: boolean;
    reason?: string;
}

export interface LineInfo {
    tiles: LineTile[];
    /** New + upgraded tiles. */
    buildable: number;
    affordable: number;
    upgrades: number;
    cost: Amounts;
    upgradeCost: Amounts;
    reason: string | null;
}

export interface PlaceInfo {
    def: BuildingDef;
    level: number;
    ok: boolean;
    reason: string | null;
    /** Allowed, with a warning (no road near). */
    warn: string | null;
    cost: Amounts;
    /** Money missing (0 when affordable). */
    short: number;
    /** Paint: footprints placed, of those valid. */
    count: number;
    valid: number;
    covered: number;
}

const SPY_FALLBACK = 25;

export class Controller {
    readonly hud = new HudStore();
    readonly ui = new UiStore();
    readonly feedback = new FeedbackStore();
    readonly overlay: Overlay = {
        hover: null,
        ghost: null,
        roadPath: [],
        selectedUid: null,
        selectedNpc: null,
        bulldoze: false,
        xray: false,
        showDistricts: false,
    };

    speed = 1;
    infinite = false;
    quality: QualitySetting = savedQuality();
    muted = read(STORAGE.muted) === '1';
    session: SaveSession | null = null;
    /** Where «К списку игр» leads. */
    backUrl = '/games';

    private resumeSpeed = 1;
    private accumulator = 0;
    private last = 0;
    private sampleAt = 0;
    private scanAt = 0;
    private scan: HomeScan = { upgradable: 0, blocked: [] };
    private lowFpsSince = 0;
    private startedAt = 0;
    private lowered = false;
    private held = new Set<PanKey>();
    private pick: {
        x: number;
        y: number;
        uids: number[];
        index: number;
    } | null = null;
    private seenStory: string | null = read(STORAGE.seenStory);
    private unsubscribers: (() => void)[] = [];

    constructor(
        readonly game: Game,
        readonly renderer: Renderer,
        readonly audio: AudioEngine | null,
        readonly tester: boolean,
    ) {
        let coach: Record<string, number> = {};

        try {
            coach = JSON.parse(read(STORAGE.coach) ?? '{}') ?? {};
        } catch {
            coach = {};
        }

        this.ui.set({ coach, hints: read(STORAGE.hints) !== '0' });
        renderer.setQuality(qualityFor(this.quality));
        audio?.setMuted(this.muted);
        this.unsubscribers.push(
            this.ui.subscribe(() => this.syncOverlay()),
            game.events.on((event) => this.onEvent(event)),
        );
        this.syncOverlay();
        this.sample(performance.now(), true);
    }

    dispose(): void {
        for (const off of this.unsubscribers) {
            off();
        }

        this.feedback.dispose();
    }

    get state(): UiState {
        return this.ui.getState();
    }

    // ——————————————————————————————————— Loop

    /** One animation frame (`now` from requestAnimationFrame). */
    frame(now: number): void {
        const game = this.game;
        const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;

        this.last = now;
        this.accumulator += dt * this.speed;

        while (this.accumulator >= 1) {
            game.tick(1);
            this.accumulator -= 1;
        }

        game.npcs.move(dt * this.speed);
        this.moveCamera(dt);
        this.renderer.frame(dt, this.overlay);
        this.audio?.ambience(
            game.epoch.ambience,
            game.clock.light(game.state.time).night,
            game.weather?.sound ?? null,
        );
        runFrame(dt);

        if (now - this.scanAt > 3000) {
            this.scanAt = now;
            this.scan = scanHomes(game);
        }

        if (now - this.sampleAt > 250) {
            this.sample(now);
            this.watchFps(now);
        }
    }

    /** The calendar year's progress 0..1, smooth between game seconds. */
    yearProgress(): number {
        const spy = this.game.clock.secondsPerYear || SPY_FALLBACK;
        const time = this.game.state.time + this.accumulator;

        return (time % spy) / spy;
    }

    private sample(now: number, first = false): void {
        this.sampleAt = now;

        const game = this.game;
        const feedback = this.feedback.getState();
        const story = game.openGoals()[0]?.id ?? null;
        const advisor: AdvisorView | null = first
            ? null
            : advise(game, this.scan);

        this.hud.sample(game, {
            speed: this.speed,
            tester: this.tester,
            infinite: this.infinite,
            fps: this.renderer.fps,
            now: Date.now(),
            advisor,
            counts: {
                upgrade: this.scan.upgradable,
                goals:
                    feedback.pendingChest > 0 || feedback.chest > 0
                        ? 'reward'
                        : story && story !== this.seenStory
                          ? 'story'
                          : null,
            },
        });
    }

    /** Auto quality steps down once when the game runs slowly (ui-spec §5.2 Settings). */
    private watchFps(now: number): void {
        this.startedAt ||= now;

        // The first seconds compile shaders and are always slow.
        if (this.quality !== 'auto' || this.lowered || now - this.startedAt < 20_000) {
            return;
        }

        if (this.renderer.fps >= 24) {
            this.lowFpsSince = 0;

            return;
        }

        this.lowFpsSince ||= now;

        if (now - this.lowFpsSince < 5000) {
            return;
        }

        const current = qualityFor('auto');
        const lower: Quality = current === 'high' ? 'medium' : 'low';

        if (lower === current) {
            return;
        }

        this.lowered = true;
        this.renderer.setQuality(lower);
        this.feedback.toast(
            'event',
            'sliders',
            t('settings.slow', { n: this.renderer.fps }),
            {
                action: {
                    label: t('settings.slowUndo'),
                    run: () => this.renderer.setQuality(current),
                },
                ms: 8000,
            },
        );
    }

    private moveCamera(dt: number): void {
        const renderer = this.renderer;
        const pan = 700 * dt;
        const held = this.held;

        if (held.has('left')) {
            renderer.panBy(pan, 0);
        }

        if (held.has('right')) {
            renderer.panBy(-pan, 0);
        }

        if (held.has('up')) {
            renderer.panBy(0, pan);
        }

        if (held.has('down')) {
            renderer.panBy(0, -pan);
        }

        if (held.has('rotL')) {
            renderer.rotateBy(-1.6 * dt);
        }

        if (held.has('rotR')) {
            renderer.rotateBy(1.6 * dt);
        }

        if (held.has('tiltUp')) {
            renderer.tiltBy(1.2 * dt);
        }

        if (held.has('tiltDown')) {
            renderer.tiltBy(-1.2 * dt);
        }
    }

    holdKey(key: PanKey, down: boolean): void {
        if (down) {
            this.held.add(key);
        } else {
            this.held.delete(key);
        }
    }

    releaseKeys(): void {
        this.held.clear();
    }

    // ——————————————————————————————————— Engine events

    private onEvent(event: GameEvent): void {
        const audio = this.audio;

        this.renderer.handle(event);

        switch (event.type) {
            case 'toast': {
                // Seasons and other small news stay off screen (gdd §11.2).
                if (event.tone === 'info') {
                    break;
                }

                const text = stripEmoji(
                    event.amount === undefined
                        ? event.text
                        : event.text.replace(
                              ':amount',
                              formatNumber(event.amount),
                          ),
                );

                this.feedback.toast(
                    event.tone === 'bad' ? 'bad' : 'good',
                    event.tone === 'bad' ? 'alert' : 'check',
                    text,
                );
                break;
            }

            case 'error':
                audio?.play('error');

                if (this.state.tool.kind === 'select') {
                    this.feedback.toast('bad', 'alert', stripEmoji(event.text));
                }

                break;
            case 'placed':
            case 'upgraded':
            case 'removed':
                audio?.play(event.sound);
                break;
            case 'sound':
                audio?.play(event.id);
                break;
            case 'researched':
            case 'achievement':
                audio?.play('upgrade');
                break;
            case 'epoch':
                audio?.play('epoch');
                this.feedback.set({
                    banner: {
                        epoch: event.epoch,
                        stars: event.stars,
                        lead: event.lead,
                    },
                });
                void this.session?.save();
                break;
            default:
                break;
        }
    }

    // ——————————————————————————————————— Overlay

    /** Writes the tool, selection and layer into the renderer's overlay. */
    private syncOverlay(): void {
        const state = this.state;
        const game = this.game;
        const overlay = this.overlay;
        const tool = state.tool;

        overlay.bulldoze = tool.kind === 'bulldoze';
        overlay.xray = state.layer === 'xray';
        overlay.showDistricts = state.layer === 'districts';
        overlay.ghost = null;
        overlay.roadPath = [];
        overlay.selectedUid =
            state.sheet === 'inspect'
                ? state.selection
                : state.sheet === 'hall'
                  ? (game.center?.uid ?? null)
                  : null;

        if (tool.kind !== 'select') {
            overlay.selectedUid = null;
        }

        switch (tool.kind) {
            case 'place': {
                if (!tool.ghost) {
                    break;
                }

                const info = this.placeInfo(tool);

                overlay.ghost = {
                    type: tool.type,
                    level: tool.level,
                    x: tool.ghost.x,
                    y: tool.ghost.y,
                    ok: info.ok || (info.short > 0 && !info.reason),
                };

                if (tool.paint.length > 1) {
                    const one = game.buildCost(info.def, tool.level);
                    let total: Amounts = {};

                    overlay.roadPath = tool.paint.map((tile) => {
                        let ok = game.canPlace(
                            tool.type,
                            tile.x,
                            tile.y,
                            0,
                            tool.level,
                        ).ok;

                        if (ok) {
                            const next = addAmounts(total, one);

                            ok = game.canAfford(next);
                            total = ok ? next : total;
                        }

                        return { x: tile.x, y: tile.y, ok };
                    });
                }

                break;
            }

            case 'move': {
                const building = game.buildings.get(tool.uid);

                if (building && tool.ghost) {
                    overlay.ghost = {
                        type: building.type,
                        level: building.level,
                        x: tool.ghost.x,
                        y: tool.ghost.y,
                        ok: this.moveInfo(tool).ok,
                        moving: building.uid,
                    };
                }

                break;
            }

            case 'line':
                overlay.roadPath = this.lineInfo(tool)
                    .tiles.filter((tile) => tile.kind !== 'same')
                    .map((tile) => ({
                        x: tile.x,
                        y: tile.y,
                        ok: tile.affordable,
                    }));
                break;
            case 'bulldoze': {
                const roads: { x: number; y: number; ok: boolean }[] = [];

                for (const uid of tool.picked) {
                    const building = game.buildings.get(uid);

                    if (!building) {
                        continue;
                    }

                    if (game.roleOf(building) === 'road') {
                        roads.push({ x: building.x, y: building.y, ok: false });
                    } else {
                        overlay.selectedUid = uid;
                    }
                }

                overlay.roadPath = roads;
                break;
            }

            default:
                break;
        }
    }

    /** The hovered tile (mouse), for the renderer's hover square. */
    setHover(tile: Tile | null): void {
        this.overlay.hover = tile;
    }

    // ——————————————————————————————————— Speed

    setSpeed(value: number): void {
        // Tester speeds keep the world off the leaderboard (gdd §2.1).
        if (value > 5) {
            this.game.markTester();
        }

        if (value > 0) {
            this.resumeSpeed = value;
        }

        this.speed = value;
        this.sample(performance.now());
    }

    togglePause(): void {
        this.setSpeed(this.speed === 0 ? this.resumeSpeed || 1 : 0);
    }

    // ——————————————————————————————————— Sheets and popovers

    open(sheet: SheetId, extra: Partial<UiState> = {}): void {
        this.ui.update((state) => ({
            ...openSheet(state, sheet, extra),
            tool:
                state.tool.kind === 'select' || sheet === 'inspect'
                    ? state.tool
                    : { kind: 'select' },
        }));

        if (sheet === 'goals') {
            this.markStorySeen();
        }

        if (sheet === 'hall') {
            const center = this.game.center;

            if (center) {
                this.focusBuilding(center.uid);
            }
        }
    }

    toggle(sheet: SheetId): void {
        this.ui.update((state) => toggleSheet(state, sheet));

        if (sheet === 'goals') {
            this.markStorySeen();
        }
    }

    close(): void {
        this.ui.set({ sheet: null, expanded: false, selection: null });
    }

    escape(): boolean {
        const patch = escape(this.state);

        if (!patch) {
            return false;
        }

        this.ui.set(patch);

        return true;
    }

    togglePopover(id: PopoverId): void {
        this.ui.update((state) => ({
            popover: state.popover === id ? null : id,
        }));
    }

    closePopover(): void {
        this.ui.set({ popover: null });
    }

    openGoals(tab: GoalsTab): void {
        this.open('goals', { goalsTab: tab });
    }

    setLayer(layer: Layer | null): void {
        this.ui.set({ layer });
    }

    expandSheet(expanded: boolean): void {
        this.ui.set({ expanded });
    }

    private markStorySeen(): void {
        const story = this.game.openGoals()[0]?.id ?? null;

        if (story && story !== this.seenStory) {
            this.seenStory = story;
            write(STORAGE.seenStory, story);
            this.sample(performance.now());
        }
    }

    /** Where a fix leads: a build tab at its card, a sheet, research (gdd §9.5). */
    openFix(target: FixTarget): void {
        if (target.kind === 'build') {
            this.openBuild(target.tab);

            return;
        }

        if (target.kind === 'research') {
            this.openGoals('research');

            return;
        }

        this.open(target.sheet);
    }

    hideAdvisor(id: string): void {
        this.ui.set({ advisorHidden: id });
    }

    setHints(on: boolean): void {
        write(STORAGE.hints, on ? '1' : '0');
        this.ui.set({ hints: on });
    }

    // ——————————————————————————————————— Selection

    select(uid: number | null): void {
        if (uid === null) {
            this.ui.update((state) =>
                state.sheet === 'inspect'
                    ? { sheet: null, selection: null }
                    : { selection: null },
            );

            return;
        }

        const building = this.game.buildings.get(uid);

        if (!building) {
            return;
        }

        if (this.game.roleOf(building) === 'center') {
            this.open('hall');

            return;
        }

        this.ui.set({
            sheet: 'inspect',
            selection: uid,
            popover: null,
            expanded: false,
        });
        this.focusBuilding(uid);
        this.audio?.play(this.game.def(building).sounds.select);
    }

    /** Taps on the same spot cycle the buildings stacked there (v2 PickCycle). */
    pickAt(px: number, py: number): void {
        const hits = this.renderer.pickBuildings(px, py).map((b) => b.uid);
        const last = this.pick;
        let index = 0;

        if (
            last &&
            Math.hypot(last.x - px, last.y - py) < 8 &&
            hits.length > 1 &&
            hits.join() === last.uids.join()
        ) {
            index = (last.index + 1) % hits.length;
        }

        this.pick = hits.length ? { x: px, y: py, uids: hits, index } : null;

        const uid = hits[index] ?? null;

        if (uid === null) {
            this.ui.update((state) =>
                state.sheet
                    ? { sheet: null, selection: null, expanded: false }
                    : null,
            );

            return;
        }

        this.ui.set({ stack: hits.length - 1 });
        this.select(uid);
    }

    /** «Здесь ещё N: выбрать следующее». */
    selectNext(): void {
        const cycle = this.pick;

        if (cycle && cycle.uids.length > 1) {
            cycle.index = (cycle.index + 1) % cycle.uids.length;
            this.select(cycle.uids[cycle.index]);
        }
    }

    // ——————————————————————————————————— Camera and the focus rule

    /** The screen point a sheet leaves free for its subject (ui-spec §5.2 focus rule). */
    private anchor(sheet: SheetId | null): [number, number] {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const layout = layoutOf(width, height);

        if (!sheet) {
            return [width / 2, height / 2];
        }

        if (layout === 'portrait') {
            return [width / 2, height * (sheet === 'build' ? 0.36 : 0.27)];
        }

        if (layout === 'landscape') {
            return [(width - Math.min(420, width * 0.52)) / 2, height / 2];
        }

        return sheet === 'build'
            ? [width / 2, height * 0.36]
            : [(width - 432) / 2, height * 0.55];
    }

    /** Glides the camera so that (x, y) sits in the part the open sheet leaves visible. */
    focusOn(x: number, y: number): void {
        const renderer = this.renderer;
        const [ax, ay] = this.anchor(this.state.sheet);
        const centre = renderer.groundAt(
            window.innerWidth / 2,
            window.innerHeight / 2,
        );
        const at = renderer.groundAt(ax, ay);

        if (!centre || !at) {
            renderer.centerOn(x, y, true);

            return;
        }

        renderer.centerOn(x - (at.x - centre.x), y - (at.y - centre.y), true);
    }

    focusBuilding(uid: number): void {
        const building = this.game.buildings.get(uid);

        if (building) {
            const { w, h } = this.game.def(building).size;

            this.focusOn(building.x + w / 2, building.y + h / 2);
        }
    }

    /** Back to the Town Hall, north up. */
    home(): void {
        const game = this.game;
        const center = game.center;

        this.renderer.setYaw(0, true);
        this.renderer.centerOn(
            center ? center.x + 1 : game.map.width / 2,
            center ? center.y + 1 : game.map.height / 2,
            true,
        );
    }

    rotateQuarter(): void {
        this.renderer.setYaw(this.renderer.view.yaw + Math.PI / 2, true);
    }

    zoom(factor: number): void {
        this.renderer.zoomBy(factor);
    }

    // ——————————————————————————————————— Build tray and placement

    openBuild(tab?: TabId): void {
        this.ui.update((state) => ({
            ...openSheet(state, 'build'),
            tool: { kind: 'select' },
            buildTab: tab ?? state.buildTab,
        }));
    }

    setBuildTab(tab: TabId): void {
        this.ui.set({ buildTab: tab });
    }

    pickCard(card: Card): void {
        if (card.builtUid !== null) {
            this.select(card.builtUid);

            return;
        }

        if (card.locked) {
            return;
        }

        if (this.game.content.roleOf(card.def) === 'road') {
            this.startLine(card.def.id, card.level.level);
        } else {
            this.startPlace(card.def.id, card.level.level, true);
        }
    }

    private bumpCoach(id: string): void {
        this.ui.update((state) => {
            const coach = { ...state.coach, [id]: (state.coach[id] ?? 0) + 1 };

            write(STORAGE.coach, JSON.stringify(coach));

            return { coach };
        });
    }

    tileAt(px: number, py: number): Tile | null {
        const ground = this.renderer.groundAt(px, py);

        return ground
            ? { x: Math.floor(ground.x), y: Math.floor(ground.y) }
            : null;
    }

    /** The footprint whose middle is under a tile. */
    footprintAt(type: string, tile: Tile): Tile {
        const { w, h } = this.game.content.building(type).size;

        return {
            x: tile.x - Math.floor((w - 1) / 2),
            y: tile.y - Math.floor((h - 1) / 2),
        };
    }

    private nextToRoad(def: BuildingDef, x: number, y: number): boolean {
        const game = this.game;

        for (const [tx, ty] of game.around(x, y, def.size.w, def.size.h, 1)) {
            if (game.isRoad(game.map.index(tx, ty))) {
                return true;
            }
        }

        return false;
    }

    /**
     * The valid spot nearest to a tile (a spiral up to `radius` tiles),
     * preferring spots next to a road (ui-spec §6.1 step 1).
     */
    findSpot(type: string, from: Tile, radius = 6): Tile | null {
        const game = this.game;
        const def = game.content.building(type);

        for (let r = 0; r <= radius; r++) {
            let fallback: Tile | null = null;

            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
                        continue;
                    }

                    const at = this.footprintAt(type, {
                        x: from.x + dx,
                        y: from.y + dy,
                    });

                    if (!game.canPlace(type, at.x, at.y).ok) {
                        continue;
                    }

                    if (this.nextToRoad(def, at.x, at.y)) {
                        return at;
                    }

                    fallback ??= at;
                }
            }

            if (fallback) {
                return fallback;
            }
        }

        return null;
    }

    private screenCentreTile(): Tile {
        const tile = this.tileAt(
            window.innerWidth / 2,
            window.innerHeight * 0.45,
        );
        const center = this.game.center;

        return (
            tile ?? (center ? { x: center.x, y: center.y } : { x: 50, y: 20 })
        );
    }

    startPlace(type: string, level: number, fromTray: boolean): void {
        const game = this.game;
        const from = this.screenCentreTile();
        const center = game.center;
        const ghost =
            this.findSpot(type, from) ??
            (center
                ? this.findSpot(type, { x: center.x, y: center.y }, 14)
                : null) ??
            this.footprintAt(type, from);

        this.ui.set({
            sheet: null,
            popover: null,
            selection: null,
            tool: { kind: 'place', type, level, ghost, paint: [], fromTray },
        });
        this.bumpCoach(
            isPaintable(game.content.building(type)) ? 'paint' : 'place',
        );
    }

    /** Placement of a building near a tile (the inspector's «Поставить …» fix). */
    placeNear(type: string, near: Tile): void {
        const def = this.game.content.building(type);
        const level = this.game.availableLevels(def).at(-1) ?? 1;
        const spot = this.findSpot(type, near, 8);

        this.startPlace(type, level, false);

        if (spot) {
            const tool = this.state.tool;

            if (tool.kind === 'place') {
                this.ui.set({ tool: { ...tool, ghost: spot } });
            }

            this.focusOn(spot.x + def.size.w / 2, spot.y + def.size.h / 2);
        }
    }

    /** Puts the ghost on a tile (its footprint centred there). */
    moveGhost(tile: Tile, vibrate = false): void {
        const tool = this.state.tool;

        if (tool.kind !== 'place' && tool.kind !== 'move') {
            return;
        }

        const type =
            tool.kind === 'place'
                ? tool.type
                : (this.game.buildings.get(tool.uid)?.type ?? '');

        if (!type) {
            return;
        }

        const ghost = this.footprintAt(type, tile);

        if (
            tool.ghost &&
            tool.ghost.x === ghost.x &&
            tool.ghost.y === ghost.y
        ) {
            return;
        }

        if (vibrate) {
            navigator.vibrate?.(5);
        }

        this.ui.set({
            tool:
                tool.kind === 'place'
                    ? { ...tool, ghost, paint: [] }
                    : { ...tool, ghost },
        });
    }

    setPlaceLevel(level: number): void {
        const tool = this.state.tool;

        if (tool.kind === 'place') {
            this.ui.set({ tool: { ...tool, level } });
        }
    }

    paintStart(): void {
        const tool = this.state.tool;

        if (tool.kind === 'place' && tool.ghost) {
            navigator.vibrate?.(12);
            this.ui.set({ tool: { ...tool, paint: [tool.ghost] } });
        }
    }

    paintTo(tile: Tile): void {
        const tool = this.state.tool;

        if (tool.kind !== 'place' || !tool.ghost) {
            return;
        }

        const paint = lPath(tool.ghost, tile, 0);
        const last = tool.paint.at(-1);
        const end = paint.at(-1)!;

        if (
            last &&
            last.x === end.x &&
            last.y === end.y &&
            tool.paint.length === paint.length
        ) {
            return;
        }

        this.ui.set({ tool: { ...tool, paint } });
    }

    /** What the placement bar shows for the tool now. */
    placeInfo(tool: Extract<Tool, { kind: 'place' }>): PlaceInfo {
        const game = this.game;
        const def = game.content.building(tool.type);
        const level = tool.level;
        const one = game.buildCost(def, level);
        const lock = game.lockReason(def) ?? game.levelLock(def, level);

        if (tool.paint.length > 1) {
            let valid = 0;
            let count = 0;
            let total: Amounts = {};

            for (const tile of tool.paint) {
                if (!game.canPlace(def.id, tile.x, tile.y, 0, level).ok) {
                    continue;
                }

                valid++;

                const next = addAmounts(total, one);

                if (game.canAfford(next)) {
                    total = next;
                    count++;
                }
            }

            const all = scaleAmounts(one, valid);

            return {
                def,
                level,
                ok: !lock && count > 0,
                reason: lock ?? (valid ? null : t('line.nothing')),
                warn: null,
                cost: count < valid ? all : total,
                short: Math.max(0, game.quote(all).total - game.money),
                count,
                valid,
                covered: 0,
            };
        }

        const ghost = tool.ghost;
        const check = ghost
            ? game.canPlace(def.id, ghost.x, ghost.y, 0, level)
            : { ok: false, reason: t('line.start') };
        const short = Math.max(0, game.quote(one).total - game.money);
        const coverage = game.content.level(def, level).effects.coverage;
        let covered = 0;

        if (ghost && coverage) {
            const area = {
                x: ghost.x,
                y: ghost.y,
                w: def.size.w,
                h: def.size.h,
            };

            for (const building of game.buildings.values()) {
                const other = game.def(building);

                if (
                    other.category === 'housing' &&
                    footprintDistance(area, {
                        x: building.x,
                        y: building.y,
                        w: other.size.w,
                        h: other.size.h,
                    }) <= coverage.radius
                ) {
                    covered++;
                }
            }
        }

        return {
            def,
            level,
            ok: Boolean(check.ok && !lock && (game.infinite || short <= 0)),
            reason: lock ?? (check.ok ? null : (check.reason ?? null)),
            warn:
                check.ok &&
                ghost &&
                def.placement.requiresRoad &&
                !this.nextToRoad(def, ghost.x, ghost.y)
                    ? t('place.noRoad')
                    : null,
            cost: one,
            short: game.infinite ? 0 : short,
            count: 1,
            valid: check.ok ? 1 : 0,
            covered,
        };
    }

    confirmPlace(): void {
        const tool = this.state.tool;
        const game = this.game;

        if (tool.kind !== 'place' || !tool.ghost) {
            return;
        }

        const def = game.content.building(tool.type);

        if (tool.paint.length > 1) {
            let last: Tile | null = null;

            for (const tile of tool.paint) {
                if (
                    game.canPlace(def.id, tile.x, tile.y, 0, tool.level).ok &&
                    game.canAfford(game.buildCost(def, tool.level))
                ) {
                    if (game.place(def.id, tile.x, tile.y, tool.level).ok) {
                        last = tile;
                    }
                }
            }

            const next = last ? this.findSpot(def.id, last) : null;

            this.ui.set({
                tool: { ...tool, paint: [], ghost: next ?? tool.ghost },
            });

            return;
        }

        if (!game.place(def.id, tool.ghost.x, tool.ghost.y, tool.level).ok) {
            return;
        }

        if (isRepeatable(game, def)) {
            const next = this.findSpot(def.id, tool.ghost);

            this.ui.set({
                tool: { ...tool, ghost: next ?? tool.ghost, paint: [] },
            });

            return;
        }

        this.ui.update((state) => ({
            tool: { kind: 'select' },
            sheet: tool.fromTray && !def.unique ? 'build' : state.sheet,
            buildTab: tabOf(game, def) ?? state.buildTab,
        }));
    }

    // ——————————————————————————————————— Move

    startMove(uid: number): void {
        const building = this.game.buildings.get(uid);

        if (!building || this.game.moveBlock(building)) {
            return;
        }

        this.ui.set({
            sheet: null,
            selection: null,
            tool: {
                kind: 'move',
                uid,
                ghost: { x: building.x, y: building.y },
            },
        });
        this.bumpCoach('place');
    }

    moveInfo(tool: Extract<Tool, { kind: 'move' }>): {
        ok: boolean;
        reason: string | null;
        cost: Amounts;
        short: number;
    } {
        const game = this.game;
        const building = game.buildings.get(tool.uid);

        if (!building || !tool.ghost) {
            return { ok: false, reason: null, cost: {}, short: 0 };
        }

        const check = game.canPlace(
            building.type,
            tool.ghost.x,
            tool.ghost.y,
            building.uid,
            building.level,
        );
        const cost = game.moveCost(building);
        const short = game.infinite
            ? 0
            : Math.max(0, game.quote(cost).total - game.money);
        const same = tool.ghost.x === building.x && tool.ghost.y === building.y;

        return {
            ok: check.ok && !same && short <= 0,
            reason: check.ok ? null : (check.reason ?? null),
            cost,
            short,
        };
    }

    confirmMove(): void {
        const tool = this.state.tool;

        if (tool.kind !== 'move' || !tool.ghost) {
            return;
        }

        if (this.game.move(tool.uid, tool.ghost.x, tool.ghost.y).ok) {
            this.ui.set({ tool: { kind: 'select' } });
            this.select(tool.uid);
        }
    }

    // ——————————————————————————————————— Lines (roads)

    startLine(type: string, level: number): void {
        this.ui.set({
            sheet: null,
            popover: null,
            selection: null,
            tool: {
                kind: 'line',
                type,
                level,
                start: null,
                end: null,
                bend: 0,
            },
        });
        this.bumpCoach('line');
    }

    setLine(start: Tile | null, end: Tile | null): void {
        const tool = this.state.tool;

        if (tool.kind === 'line') {
            this.ui.set({ tool: { ...tool, start, end } });
        }
    }

    toggleBend(): void {
        const tool = this.state.tool;

        if (tool.kind === 'line') {
            this.ui.set({ tool: { ...tool, bend: tool.bend ? 0 : 1 } });
        }
    }

    setLineLevel(level: number): void {
        const tool = this.state.tool;

        if (tool.kind === 'line') {
            this.ui.set({ tool: { ...tool, level } });
        }
    }

    /** The tiles of the drawn line, what each costs, how far the money goes. */
    lineInfo(tool: Extract<Tool, { kind: 'line' }>): LineInfo {
        const game = this.game;
        const def = game.content.building(tool.type);
        const empty: LineInfo = {
            tiles: [],
            buildable: 0,
            affordable: 0,
            upgrades: 0,
            cost: {},
            upgradeCost: {},
            reason: null,
        };

        if (!tool.start) {
            return empty;
        }

        const path = lPath(tool.start, tool.end ?? tool.start, tool.bend);
        const tiles: LineTile[] = [];
        let total: Amounts = {};
        let upgradeCost: Amounts = {};
        let buildable = 0;
        let affordable = 0;
        let upgrades = 0;
        let reason: string | null = null;
        let broke = false;

        for (const { x, y } of path) {
            const existing = game.buildingAt(x, y);
            let kind: LineTile['kind'];
            let cost: Amounts = {};
            let why: string | undefined;

            if (existing && game.roleOf(existing) === 'road') {
                if (existing.level < tool.level && game.isComplete(existing)) {
                    kind = 'up';
                    cost = game.relevelCost(existing, tool.level);
                } else {
                    kind = 'same';
                }
            } else {
                const check = game.canPlace(def.id, x, y);

                if (check.ok) {
                    kind = 'new';
                    cost = game.buildCost(def, tool.level);
                } else {
                    kind = 'bad';
                    why = check.reason;
                    reason ??= check.reason ?? null;
                }
            }

            let fits = false;

            if (kind === 'new' || kind === 'up') {
                buildable++;

                const next = addAmounts(total, cost);

                if (!broke && game.canAfford(next)) {
                    total = next;
                    affordable++;
                    fits = true;

                    if (kind === 'up') {
                        upgrades++;
                        upgradeCost = addAmounts(upgradeCost, cost);
                    }
                } else {
                    broke = true;
                }
            }

            tiles.push({ x, y, kind, affordable: fits, reason: why });
        }

        return {
            tiles,
            buildable,
            affordable,
            upgrades,
            cost: total,
            upgradeCost,
            reason,
        };
    }

    /** Builds the affordable part; the end becomes the next start (chain drawing). */
    confirmLine(): void {
        const tool = this.state.tool;
        const game = this.game;

        if (tool.kind !== 'line' || !tool.start) {
            return;
        }

        const info = this.lineInfo(tool);
        let upgraded = 0;

        for (const tile of info.tiles) {
            if (!tile.affordable) {
                continue;
            }

            if (tile.kind === 'up') {
                const existing = game.buildingAt(tile.x, tile.y);

                if (
                    existing &&
                    game.relevel(existing.uid, tool.level, true).ok
                ) {
                    upgraded++;
                }
            } else if (tile.kind === 'new') {
                game.place(tool.type, tile.x, tile.y, tool.level);
            }
        }

        if (upgraded) {
            game.structureChanged();
            this.audio?.play(game.content.building(tool.type).sounds.upgrade);
        }

        const end = tool.end ?? tool.start;

        this.ui.set({ tool: { ...tool, start: end, end: null } });
    }

    // ——————————————————————————————————— Bulldozer

    startBulldoze(): void {
        this.ui.set({
            sheet: null,
            popover: null,
            selection: null,
            tool: { kind: 'bulldoze', picked: [] },
        });
    }

    toggleBulldoze(): void {
        if (this.state.tool.kind === 'bulldoze') {
            this.ui.set({ tool: { kind: 'select' } });
        } else {
            this.startBulldoze();
        }
    }

    /** Picks the building under a point (the Town Hall cannot be picked). */
    bulldozePick(px: number, py: number): void {
        const game = this.game;
        const tile = this.tileAt(px, py);
        const building =
            this.renderer.pickBuildings(px, py)[0] ??
            (tile ? game.buildingAt(tile.x, tile.y) : undefined);

        if (!building || game.roleOf(building) === 'center') {
            this.ui.set({ tool: { kind: 'bulldoze', picked: [] } });

            if (building) {
                this.feedback.toast('bad', 'alert', t('bulldoze.center'));
            }

            return;
        }

        this.ui.set({ tool: { kind: 'bulldoze', picked: [building.uid] } });
    }

    /** A run of road tiles along an L-path. */
    bulldozeRun(from: Tile, to: Tile): void {
        const game = this.game;
        const picked: number[] = [];

        for (const tile of lPath(from, to, 0)) {
            const building = game.buildingAt(tile.x, tile.y);

            if (
                building &&
                game.roleOf(building) === 'road' &&
                !picked.includes(building.uid)
            ) {
                picked.push(building.uid);
            }
        }

        this.ui.set({ tool: { kind: 'bulldoze', picked } });
    }

    bulldozeInfo(picked: readonly number[]): {
        name: string;
        refund: number;
        roads: number;
    } {
        const game = this.game;
        let refund = 0;
        let roads = 0;
        let name = '';

        for (const uid of picked) {
            const building = game.buildings.get(uid);

            if (!building) {
                continue;
            }

            refund += game.refund(building);
            roads += game.roleOf(building) === 'road' ? 1 : 0;
            name ||= game.nameOf(building);
        }

        return { name, refund, roads };
    }

    /** Demolishes what is picked and offers «Отменить» for 5 s. */
    demolishNow(uids: readonly number[]): void {
        const game = this.game;
        const done = demolish(game, uids);

        if (!done) {
            return;
        }

        this.ui.update((state) => ({
            tool:
                state.tool.kind === 'bulldoze'
                    ? { kind: 'bulldoze', picked: [] }
                    : state.tool,
            selection: uids.includes(state.selection ?? -1)
                ? null
                : state.selection,
            sheet:
                state.sheet === 'inspect' &&
                uids.includes(state.selection ?? -1)
                    ? null
                    : state.sheet,
        }));

        const count = done.buildings.length;
        const text =
            count > 1
                ? t('bulldoze.doneRun', {
                      n: count,
                      word: word(count, 'tiles'),
                      m: formatNumber(done.refund),
                  })
                : t('bulldoze.done', {
                      name: done.name,
                      n: formatNumber(done.refund),
                  });

        this.feedback.toast('good', 'bulldoze', text, {
            urgent: true,
            ms: 5000,
            action: {
                label: t('bulldoze.undo'),
                run: () => {
                    if (undoDemolition(game, done)) {
                        this.audio?.play('click');
                    } else {
                        this.feedback.toast(
                            'bad',
                            'alert',
                            t('bulldoze.undone'),
                        );
                    }
                },
            },
        });
    }

    confirmBulldoze(): void {
        const tool = this.state.tool;

        if (tool.kind === 'bulldoze' && tool.picked.length) {
            this.demolishNow(tool.picked);
        }
    }

    // ——————————————————————————————————— Confirm, cancel

    /** ✓ or Enter for whichever tool is on. */
    confirm(): void {
        switch (this.state.tool.kind) {
            case 'place':
                this.confirmPlace();
                break;
            case 'move':
                this.confirmMove();
                break;
            case 'line':
                this.confirmLine();
                break;
            case 'bulldoze':
                this.confirmBulldoze();
                break;
            default:
                break;
        }
    }

    cancelTool(): void {
        const patch = escape({ ...this.state, sheet: null, popover: null });

        if (patch) {
            this.ui.set(patch);
        }
    }

    // ——————————————————————————————————— Strips

    openStrip(side: Side): void {
        const offer = landOffer(this.game, side);

        this.ui.update((state) => ({
            ...openSheet(state, 'strip'),
            strip: side,
        }));

        if (offer) {
            this.focusOn(
                (offer.minX + offer.maxX + 1) / 2,
                this.game.layout.beachY * 0.75,
            );
        }
    }

    buyStrip(side: Side): boolean {
        const offer = landOffer(this.game, side);

        if (!offer || !buyStrip(this.game, side)) {
            return false;
        }

        this.game.revision++;
        this.feedback.toast(
            'good',
            'check',
            t('strip.bought', { name: stripInfo(offer.minX).name }),
        );
        this.close();
        this.audio?.play('upgrade');

        return true;
    }

    takeLoan(amount?: number): void {
        if (this.game.takeLoan(amount).ok) {
            this.feedback.toast(
                'good',
                'chest',
                t('toast.loan', {
                    n: formatNumber(this.game.state.economy.loan),
                }),
            );
        }
    }

    // ——————————————————————————————————— Settings and tester tools

    setQuality(setting: QualitySetting): void {
        this.quality = setting;
        this.lowered = false;
        write(STORAGE.quality, setting);
        this.renderer.setQuality(qualityFor(setting));
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        write(STORAGE.muted, muted ? '1' : '0');
        this.audio?.unlock();
        this.audio?.setMuted(muted);
    }

    setInfinite(on: boolean): void {
        this.infinite = on;
        this.game.infinite = on;

        if (on) {
            this.game.testerGrant();
        }

        this.sample(performance.now());
    }

    takeChest(): void {
        const { chest, pendingChest } = this.feedback.getState();
        const amount = chest || pendingChest;

        if (amount > 0 && this.game.claimChest(amount).ok) {
            void this.session?.save();
        }

        this.feedback.set({ chest: 0, pendingChest: 0 });
        this.sample(performance.now());
    }

    laterChest(): void {
        const { chest } = this.feedback.getState();

        this.feedback.set({ chest: 0, pendingChest: chest });
        this.sample(performance.now());
    }
}

/** Two price lists added. */
export function addAmounts(a: Amounts, b: Amounts): Amounts {
    const sum: Amounts = { ...a };

    for (const [id, value] of Object.entries(b)) {
        sum[id] = (sum[id] ?? 0) + value;
    }

    return sum;
}

export function scaleAmounts(a: Amounts, k: number): Amounts {
    return Object.fromEntries(
        Object.entries(a).map(([id, value]) => [id, value * k]),
    );
}
