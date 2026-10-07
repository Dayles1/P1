import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './epochs.css';
import { GameApiError, gameApi } from '../shared/api';
import { usePlaytime } from '../shared/usePlaytime';
import { AudioEngine } from './audio/audio';
import { loadContent } from './content-api';
import type { LoadedContent } from './content-api';
import type { GameEvent } from './engine/core/events';
import {
    catchUp,
    fromServer,
    restoreChanges,
    takeChanges,
    toCreatePayload,
} from './engine/save/serializer';
import type { LoadedWorld } from './engine/save/serializer';
import { Game } from './engine/sim/game';
import { Renderer } from './scene/renderer';
import type { Overlay, Quality } from './scene/renderer';
import { BuildDock } from './ui/build';
import { Bureau } from './ui/bureau';
import { Modal } from './ui/common';
import { EpochPanel, EpochSplash, Goals, Stats } from './ui/epoch';
import { CameraControls, GoalsWidget, TopBar } from './ui/hud';
import { Inspector, NpcPanel } from './ui/inspector';
import { TechTree } from './ui/research';

type Tool =
    | { kind: 'select' }
    | { kind: 'build'; type: string; level: number }
    | { kind: 'bulldoze' }
    | { kind: 'move'; uid: number };

type Panel = 'stats' | 'epoch' | 'menu' | 'tech' | 'bureau' | 'goals' | null;

interface Toast {
    id: number;
    text: string;
    tone: 'info' | 'good' | 'bad';
}

/** The last click on buildings: clicking the same spot again picks the next one behind. */
interface PickCycle {
    x: number;
    y: number;
    uids: number[];
    index: number;
}

const AUTOSAVE_MS = 20_000;
const TITLE = 'Летопись города 2';
const QUALITY_KEY = 'city2.quality';

function savedQuality(): Quality {
    try {
        const value = localStorage.getItem(QUALITY_KEY);

        return value === 'low' || value === 'medium' ? value : 'high';
    } catch {
        return 'high';
    }
}

let toastSeq = 0;

/**
 * «Летопись города 2»: the 3D scene, the HUD around it, the loop, input,
 * sound and saving. Everything the game is made of comes from the content
 * files.
 */
export default function EpochsGame() {
    usePlaytime('epochs');
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<Game | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const audioRef = useRef<AudioEngine | null>(null);
    const revisionRef = useRef<number | null>(null);
    const savedGameRevision = useRef(0);
    const savingRef = useRef(false);
    const conflictRef = useRef(false);
    const overlayRef = useRef<Overlay>({
        hover: null,
        ghost: null,
        roadPath: [],
        selectedUid: null,
        selectedNpc: null,
        bulldoze: false,
        xray: false,
        showDistricts: false,
    });
    const toolRef = useRef<Tool>({ kind: 'select' });
    const speedRef = useRef(1);
    const followRef = useRef<number | null>(null);
    const pickRef = useRef<PickCycle | null>(null);

    const [loaded, setLoaded] = useState<LoadedContent | null>(null);
    const [game, setGame] = useState<Game | null>(null);
    const [phase, setPhase] = useState<'content' | 'world' | 'ready' | 'error'>(
        'content',
    );
    const [error, setError] = useState('');
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const [tool, setToolState] = useState<Tool>({ kind: 'select' });
    const [selectedUid, setSelectedUid] = useState<number | null>(null);
    const [selectedNpc, setSelectedNpc] = useState<number | null>(null);
    const [following, setFollowing] = useState(false);
    const [panel, setPanel] = useState<Panel>(null);
    const [dockOpen, setDockOpen] = useState(true);
    const [goalsCollapsed, setGoalsCollapsed] = useState(false);
    const [levels, setLevels] = useState<Record<string, number>>({});
    const [speed, setSpeedState] = useState(1);
    const [muted, setMuted] = useState(false);
    const [xray, setXray] = useState(false);
    const [districts, setDistricts] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [splash, setSplash] = useState<number | null>(null);
    const [saveLabel, setSaveLabel] = useState('');
    const [conflict, setConflict] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [yaw, setYaw] = useState(0);
    const [infinite, setInfiniteState] = useState(false);
    const [quality, setQualityState] = useState<Quality>(savedQuality);
    const [fps, setFps] = useState(60);
    const [others, setOthers] = useState(0);

    const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
        const id = ++toastSeq;

        setToasts((list) => [...list.slice(-3), { id, text, tone }]);
        window.setTimeout(
            () => setToasts((list) => list.filter((t) => t.id !== id)),
            tone === 'bad' ? 6500 : 4500,
        );
    }, []);

    const setTool = useCallback((next: Tool) => {
        toolRef.current = next;
        overlayRef.current.ghost = null;
        overlayRef.current.roadPath = [];
        overlayRef.current.bulldoze = next.kind === 'bulldoze';
        setToolState(next);
        setHint(null);
    }, []);

    const selectBuilding = useCallback((uid: number | null) => {
        overlayRef.current.selectedUid = uid;
        overlayRef.current.selectedNpc = null;
        followRef.current = null;
        setSelectedUid(uid);
        setSelectedNpc(null);
        setFollowing(false);

        if (uid === null) {
            pickRef.current = null;
            setOthers(0);
        }
    }, []);

    const selectNpc = useCallback((uid: number | null) => {
        overlayRef.current.selectedNpc = uid;
        overlayRef.current.selectedUid = null;
        setSelectedNpc(uid);
        setSelectedUid(null);
    }, []);

    const setSpeed = useCallback((value: number) => {
        speedRef.current = value;
        setSpeedState(value);
    }, []);

    const setInfinite = useCallback((on: boolean) => {
        if (gameRef.current) {
            gameRef.current.infinite = on;

            if (on) {
                gameRef.current.testerGrant();
            }
        }

        setInfiniteState(on);
    }, []);

    const setQuality = useCallback((value: Quality) => {
        rendererRef.current?.setQuality(value);
        setQualityState(value);

        try {
            localStorage.setItem(QUALITY_KEY, value);
        } catch {
            // Storage blocked: the choice lasts until the page closes.
        }
    }, []);

    const toggleXray = useCallback(() => {
        setXray((on) => {
            overlayRef.current.xray = !on;

            return !on;
        });
    }, []);

    // ——————————————————————————————————— Saving

    const save = useCallback(
        async (keepalive = false) => {
            const current = gameRef.current;

            if (
                !current ||
                conflictRef.current ||
                savingRef.current ||
                revisionRef.current === null
            ) {
                return;
            }

            savingRef.current = true;
            savedGameRevision.current = current.revision;
            setSaveLabel('💾 Сохранение…');

            const payload = takeChanges(current, revisionRef.current);

            try {
                const result = await gameApi<{ revision: number }>(
                    'epochs/world',
                    { method: 'PUT', body: payload, keepalive },
                );

                revisionRef.current = result.revision;
                setSaveLabel('✓ Сохранено');
            } catch (failure) {
                restoreChanges(current, payload);

                if (failure instanceof GameApiError && failure.status === 409) {
                    conflictRef.current = true;
                    setConflict(true);
                    setSpeed(0);
                } else {
                    savedGameRevision.current = -1;
                    setSaveLabel('⚠ Не сохранено');
                }
            } finally {
                savingRef.current = false;
            }
        },
        [setSpeed],
    );

    // ——————————————————————————————————— Loading

    useEffect(() => {
        const renderer = new Renderer(canvasRef.current!);

        rendererRef.current = renderer;
        renderer.setQuality(savedQuality());
        document.title = TITLE;

        let cancelled = false;

        (async () => {
            const content = await loadContent();

            if (cancelled) {
                return;
            }

            setLoaded(content);

            if (content.issues.length) {
                setError(
                    'Настройки игры содержат ошибки. Исправьте их в Мастерской.',
                );
                setPhase('error');

                return;
            }

            setPhase('world');
            audioRef.current = new AudioEngine(content.bundle.sounds);

            const saved = await gameApi<LoadedWorld | null>('epochs/world');
            let world: Game;

            if (saved) {
                world = fromServer(content.content, saved);
                revisionRef.current = saved.revision;

                const away = catchUp(world, saved.saved_at);

                if (away && away.seconds >= 60) {
                    toast(
                        `🌙 Пока вас не было (${Math.round(away.seconds / 60)} мин): ${away.population >= 0 ? '+' : ''}${away.population} жителей, ${away.gold >= 0 ? '+' : ''}${away.gold} золота`,
                        'good',
                    );
                }
            } else {
                world = Game.create(content.content);

                const created = await gameApi<{ revision: number }>(
                    'epochs/world',
                    { method: 'POST', body: toCreatePayload(world) },
                );

                revisionRef.current = created.revision;
                toast(
                    `🏕️ ${world.epoch.year} год. ${world.epoch.tagline}`,
                    'info',
                );
            }

            if (cancelled) {
                return;
            }

            gameRef.current = world;
            savedGameRevision.current = world.revision;

            renderer.attach(world);
            renderer.resize();

            const center = world.center;

            renderer.centerOn(
                center ? center.x + 1 : world.map.width / 2,
                center ? center.y + 1 : world.map.height / 2,
            );
            setGame(world);
            setPhase('ready');
        })().catch((failure: unknown) => {
            if (!cancelled) {
                setError(
                    failure instanceof Error
                        ? failure.message
                        : 'Не удалось загрузить игру',
                );
                setPhase('error');
            }
        });

        return () => {
            cancelled = true;
            renderer.dispose();
        };
    }, [toast]);

    // Engine events → effects, sound, toasts.
    useEffect(() => {
        if (!game) {
            return;
        }

        const renderer = rendererRef.current!;
        const audio = audioRef.current;

        return game.events.on((event: GameEvent) => {
            renderer.handle(event);

            switch (event.type) {
                case 'toast':
                    toast(event.text, event.tone);
                    break;
                case 'error':
                    audio?.play('error');
                    setHint(event.text);
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
                    setSplash(event.epoch);
                    void save();
                    break;
                case 'weather':
                    toast(
                        `${game.weather?.icon} ${game.weather?.name}`,
                        'info',
                    );
                    break;
            }
        });
    }, [game, save, toast]);

    // ——————————————————————————————————— Loop & keyboard

    useEffect(() => {
        if (!game) {
            return;
        }

        const renderer = rendererRef.current!;
        const keys = new Set<string>();
        let last = performance.now();
        let accumulator = 0;
        let lastUi = 0;
        let frame = 0;

        const loop = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            const gameDt = dt * speedRef.current;

            last = now;
            accumulator += gameDt;

            while (accumulator >= 1) {
                game.tick(1);
                accumulator -= 1;
            }

            game.npcs.move(gameDt);

            const pan = 700 * dt;

            if (keys.has('a') || keys.has('arrowleft')) {
                renderer.panBy(pan, 0);
            }

            if (keys.has('d') || keys.has('arrowright')) {
                renderer.panBy(-pan, 0);
            }

            if (keys.has('w') || keys.has('arrowup')) {
                renderer.panBy(0, pan);
            }

            if (keys.has('s') || keys.has('arrowdown')) {
                renderer.panBy(0, -pan);
            }

            if (keys.has('q')) {
                renderer.rotateBy(-1.6 * dt);
            }

            if (keys.has('e')) {
                renderer.rotateBy(1.6 * dt);
            }

            if (keys.has('pageup')) {
                renderer.tiltBy(1.2 * dt);
            }

            if (keys.has('pagedown')) {
                renderer.tiltBy(-1.2 * dt);
            }

            if (followRef.current) {
                const npc = game.npcs.get(followRef.current);

                if (npc) {
                    renderer.centerOn(npc.x, npc.y, true);
                }
            }

            renderer.frame(dt, overlayRef.current);
            audioRef.current?.ambience(
                game.epoch.ambience,
                game.clock.light(game.state.time).night,
                game.weather?.sound ?? null,
            );

            if (now - lastUi > 250) {
                lastUi = now;
                setYaw(renderer.view.yaw);
                setFps(renderer.fps);
                rerender();
            }

            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLSelectElement
            ) {
                return;
            }

            const key = event.key.toLowerCase();

            keys.add(key);

            if (key === ' ') {
                event.preventDefault();
                setSpeed(speedRef.current === 0 ? 1 : 0);
            } else if (key === 'escape') {
                setTool({ kind: 'select' });
                selectBuilding(null);
            } else if (key === 'b') {
                setDockOpen((open) => !open);
            } else if (key === 'r') {
                const road = game.content.byRole('road');

                if (road) {
                    setTool({
                        kind: 'build',
                        type: road.id,
                        level: game.availableLevels(road).at(-1) ?? 1,
                    });
                }
            } else if (key === 'x') {
                setTool({ kind: 'bulldoze' });
            } else if (key === 't') {
                setPanel((open) => (open === 'tech' ? null : 'tech'));
            } else if (key === 'g') {
                setPanel((open) => (open === 'goals' ? null : 'goals'));
            } else if (key === 'v') {
                toggleXray();
            } else if (key === 'home') {
                const center = game.center;

                renderer.centerOn(
                    center ? center.x + 1 : game.map.width / 2,
                    center ? center.y + 1 : game.map.height / 2,
                    true,
                );
            } else if (key === '+' || key === '=') {
                renderer.zoomBy(1.2);
            } else if (key === '-') {
                renderer.zoomBy(1 / 1.2);
            }
        };
        const onKeyUp = (event: KeyboardEvent) =>
            keys.delete(event.key.toLowerCase());
        const onBlur = () => keys.clear();
        const onResize = () => renderer.resize();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('resize', onResize);
        };
    }, [game, selectBuilding, setSpeed, setTool, toggleXray]);

    // Autosave, plus a last save when the tab hides or the page is left.
    useEffect(() => {
        if (!game) {
            return;
        }

        const dirty = () => game.revision !== savedGameRevision.current;
        const timer = window.setInterval(() => dirty() && save(), AUTOSAVE_MS);
        const onHide = () =>
            document.visibilityState === 'hidden' && dirty() && save(true);

        document.addEventListener('visibilitychange', onHide);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onHide);

            if (dirty()) {
                void save(true);
            }
        };
    }, [game, save]);

    // ——————————————————————————————————— Pointer

    useEffect(() => {
        if (!game) {
            return;
        }

        const canvas = canvasRef.current!;
        const renderer = rendererRef.current!;
        const pointers = new Map<number, { x: number; y: number }>();
        let drag: {
            x: number;
            y: number;
            startX: number;
            startY: number;
            moved: boolean;
            button: number;
            roadFrom: { x: number; y: number } | null;
        } | null = null;
        let pinch: {
            distance: number;
            angle: number;
            x: number;
            y: number;
        } | null = null;

        const local = (event: PointerEvent | MouseEvent) => {
            const box = canvas.getBoundingClientRect();

            return { x: event.clientX - box.left, y: event.clientY - box.top };
        };
        const tileAt = (px: number, py: number) => {
            const world = renderer.groundAt(px, py);

            return world
                ? { x: Math.floor(world.x), y: Math.floor(world.y) }
                : null;
        };
        const footprintAt = (type: string, px: number, py: number) => {
            const size = game.content.building(type).size;
            const world = renderer.groundAt(px, py);

            return world
                ? {
                      x: Math.round(world.x - size.w / 2),
                      y: Math.round(world.y - size.h / 2),
                  }
                : null;
        };
        const isRoadType = (type: string) =>
            game.content.building(type).role === 'road';
        const roadPath = (
            from: { x: number; y: number },
            to: { x: number; y: number },
        ) => {
            const path: { x: number; y: number; ok: boolean }[] = [];
            const sx = Math.sign(to.x - from.x);
            const sy = Math.sign(to.y - from.y);
            const push = (x: number, y: number) => {
                const existing = game.buildingAt(x, y);

                path.push({
                    x,
                    y,
                    ok:
                        (existing !== undefined &&
                            game.def(existing).role === 'road') ||
                        game.canPlace(game.content.byRole('road')!.id, x, y).ok,
                });
            };

            for (let x = from.x; ; x += sx) {
                push(x, from.y);

                if (x === to.x) {
                    break;
                }
            }

            for (let y = from.y + sy; sy !== 0; y += sy) {
                push(to.x, y);

                if (y === to.y) {
                    break;
                }
            }

            return path;
        };

        const updateHover = (px: number, py: number) => {
            const active = toolRef.current;
            const overlay = overlayRef.current;
            const hover = tileAt(px, py);

            overlay.hover = hover;

            if (!hover) {
                overlay.ghost = null;

                return;
            }

            if (active.kind === 'build' && !isRoadType(active.type)) {
                const at = footprintAt(active.type, px, py)!;
                const check = game.canPlace(active.type, at.x, at.y);

                overlay.ghost = {
                    type: active.type,
                    level: active.level,
                    ...at,
                    ok: check.ok,
                };
                setHint(check.ok ? null : (check.reason ?? null));
            } else if (active.kind === 'move') {
                const moving = game.buildings.get(active.uid);

                if (moving) {
                    const at = footprintAt(moving.type, px, py)!;
                    const check = game.canPlace(
                        moving.type,
                        at.x,
                        at.y,
                        moving.uid,
                    );

                    overlay.ghost = {
                        type: moving.type,
                        level: moving.level,
                        ...at,
                        ok: check.ok,
                        moving: moving.uid,
                    };
                    setHint(check.ok ? null : (check.reason ?? null));
                }
            } else if (
                active.kind === 'build' &&
                isRoadType(active.type) &&
                !drag?.roadFrom
            ) {
                overlay.roadPath = roadPath(hover, hover);
            } else {
                overlay.ghost = null;
            }
        };

        const pickAt = (px: number, py: number) => {
            const npc = renderer.pickNpc(px, py);

            if (npc) {
                pickRef.current = null;
                selectNpc(npc.uid);
                audioRef.current?.play('click');

                return;
            }

            const hits = renderer.pickBuildings(px, py).map((b) => b.uid);
            const last = pickRef.current;
            let index = 0;

            if (
                last &&
                Math.hypot(last.x - px, last.y - py) < 6 &&
                hits.length > 1 &&
                hits.join() === last.uids.join()
            ) {
                index = (last.index + 1) % hits.length;
            }

            pickRef.current = hits.length
                ? { x: px, y: py, uids: hits, index }
                : null;

            const uid = hits[index] ?? null;

            selectBuilding(uid);

            if (uid !== null) {
                pickRef.current = { x: px, y: py, uids: hits, index };
                setOthers(hits.length - 1);

                const building = game.buildings.get(uid);

                if (building) {
                    audioRef.current?.play(game.def(building).sounds.select);
                }
            }
        };

        const click = (px: number, py: number) => {
            const active = toolRef.current;

            if (active.kind === 'select') {
                pickAt(px, py);

                return;
            }

            if (active.kind === 'bulldoze') {
                const tile = tileAt(px, py);
                const building =
                    renderer.pickBuildings(px, py)[0] ??
                    (tile ? game.buildingAt(tile.x, tile.y) : undefined);

                if (building) {
                    game.demolish(building.uid);

                    if (building.uid === overlayRef.current.selectedUid) {
                        selectBuilding(null);
                    }
                } else if (tile) {
                    game.clear(tile.x, tile.y);
                }

                return;
            }

            const ghost = overlayRef.current.ghost;

            if (!ghost) {
                return;
            }

            if (active.kind === 'move') {
                if (game.move(active.uid, ghost.x, ghost.y).ok) {
                    setTool({ kind: 'select' });
                    selectBuilding(active.uid);
                }

                return;
            }

            if (active.kind === 'build') {
                const def = game.content.building(active.type);

                if (
                    game.place(active.type, ghost.x, ghost.y, active.level)
                        .ok &&
                    def.unique
                ) {
                    setTool({ kind: 'select' });
                }

                updateHover(px, py);
            }
        };

        const buildRoad = (level: number) => {
            const road = game.content.byRole('road')!;
            let upgraded = 0;

            for (const step of overlayRef.current.roadPath) {
                const existing = game.buildingAt(step.x, step.y);

                if (existing && game.def(existing).role === 'road') {
                    // Laying a better road over an old one upgrades it.
                    if (existing.level < level) {
                        if (game.relevel(existing.uid, level, true).ok) {
                            upgraded++;
                        } else if (
                            !game.canAfford(game.relevelCost(existing, level))
                        ) {
                            break;
                        }
                    }

                    continue;
                }

                if (
                    !game.place(road.id, step.x, step.y, level).ok &&
                    !game.canAfford(game.buildCost(road, level))
                ) {
                    break;
                }
            }

            overlayRef.current.roadPath = [];

            if (upgraded) {
                game.structureChanged();
                audioRef.current?.play(road.sounds.upgrade);
                toast(`🛤️ Дорога улучшена: ${upgraded} кл.`, 'good');
            }
        };

        const onDown = (event: PointerEvent) => {
            audioRef.current?.unlock();
            canvas.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, local(event));

            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];

                pinch = {
                    distance: Math.hypot(a.x - b.x, a.y - b.y),
                    angle: Math.atan2(b.y - a.y, b.x - a.x),
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2,
                };
                drag = null;

                return;
            }

            const point = local(event);
            const active = toolRef.current;
            const roadFrom =
                event.button === 0 &&
                active.kind === 'build' &&
                isRoadType(active.type)
                    ? tileAt(point.x, point.y)
                    : null;

            drag = {
                ...point,
                startX: point.x,
                startY: point.y,
                moved: false,
                button: event.button,
                roadFrom,
            };

            if (roadFrom) {
                overlayRef.current.roadPath = roadPath(roadFrom, roadFrom);
            }
        };

        const onMove = (event: PointerEvent) => {
            const point = local(event);

            if (pointers.has(event.pointerId)) {
                pointers.set(event.pointerId, point);
            }

            if (pinch && pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                const distance = Math.hypot(a.x - b.x, a.y - b.y);
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

                renderer.zoomBy(distance / pinch.distance, mid.x, mid.y);
                renderer.rotateBy(pinch.angle - angle);
                renderer.panBy(mid.x - pinch.x, mid.y - pinch.y);
                pinch = { distance, angle, ...mid };

                return;
            }

            if (drag?.roadFrom) {
                const tile = tileAt(point.x, point.y);

                if (tile) {
                    overlayRef.current.roadPath = roadPath(drag.roadFrom, tile);
                }

                return;
            }

            if (
                drag &&
                (drag.moved ||
                    Math.hypot(point.x - drag.startX, point.y - drag.startY) >
                        5)
            ) {
                const dx = point.x - drag.x;
                const dy = point.y - drag.y;

                if (drag.button === 2 || drag.button === 1 || event.shiftKey) {
                    renderer.rotateBy(-dx * 0.008);
                    renderer.tiltBy(dy * 0.006);
                } else {
                    renderer.panBy(dx, dy);
                    followRef.current = null;
                }

                drag.x = point.x;
                drag.y = point.y;
                drag.moved = true;
                canvas.style.cursor =
                    drag.button === 0 && !event.shiftKey ? 'grabbing' : 'move';

                return;
            }

            updateHover(point.x, point.y);
        };

        const onUp = (event: PointerEvent) => {
            pointers.delete(event.pointerId);
            canvas.style.cursor = '';

            if (pinch) {
                if (pointers.size < 2) {
                    pinch = null;
                }

                return;
            }

            const finished = drag;

            drag = null;

            if (!finished) {
                return;
            }

            if (finished.roadFrom) {
                const active = toolRef.current;

                buildRoad(active.kind === 'build' ? active.level : 1);

                return;
            }

            if (finished.moved) {
                return;
            }

            const point = local(event);

            if (finished.button === 2) {
                setTool({ kind: 'select' });
            } else if (finished.button === 0) {
                click(point.x, point.y);
            }
        };

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();

            const point = local(event);

            renderer.zoomBy(
                Math.exp(-Math.sign(event.deltaY) * 0.12),
                point.x,
                point.y,
            );
        };
        const onLeave = () => {
            overlayRef.current.hover = null;
        };
        const onContext = (event: MouseEvent) => event.preventDefault();

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', onContext);

        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('pointerleave', onLeave);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('contextmenu', onContext);
        };
    }, [game, selectBuilding, selectNpc, setTool, toast]);

    // ——————————————————————————————————— HUD

    const restart = async () => {
        if (!window.confirm('Начать новый мир? Текущий город будет удалён.')) {
            return;
        }

        await gameApi('epochs/world', { method: 'DELETE' }).catch(() => null);
        window.location.reload();
    };

    const selected =
        game && selectedUid ? game.buildings.get(selectedUid) : undefined;
    const npc = game && selectedNpc ? game.npcs.get(selectedNpc) : undefined;
    const theme = game?.epoch.theme;
    const themeStyle = theme
        ? ({
              '--hud-bg': theme.bg,
              '--hud-bg-solid': theme.solid,
              '--hud-border': theme.border,
              '--hud-text': theme.text,
              '--hud-muted': theme.muted,
              '--hud-accent': theme.accent,
              '--hud-accent-text': theme.accentText,
              '--hud-font': theme.font,
              '--hud-radius': `${theme.radius}px`,
          } as CSSProperties)
        : undefined;
    const activeBuild =
        tool.kind === 'build' ? { type: tool.type, level: tool.level } : null;
    const roadDef = game?.content.byRole('road');
    const toolHint =
        tool.kind === 'build' && game && roadDef?.id === tool.type
            ? `Дорога «${game.content.level(roadDef, tool.level).name}»: тяните мышью. Esc или ПКМ — отмена.`
            : tool.kind === 'build' && game
              ? `Строим: ${game.content.level(game.content.building(tool.type), tool.level).name}. Клик — поставить, Esc — отмена.`
              : tool.kind === 'bulldoze'
                ? 'Снос: клик по зданию (вернётся половина стоимости), по дереву, камню или камышу — расчистить.'
                : tool.kind === 'move'
                  ? 'Выберите новое место. Esc — отмена.'
                  : null;

    return (
        <div className="city epochs" style={themeStyle}>
            <canvas
                ref={canvasRef}
                className={`city__canvas${tool.kind !== 'select' ? ' city__canvas--tool' : ''}`}
            />

            {phase !== 'ready' && (
                <div className="city__loading">
                    {phase === 'content' && 'Загружаем настройки…'}
                    {phase === 'world' && 'Загружаем ваш мир…'}
                    {phase === 'error' && (
                        <div className="epochs-error">
                            <p>{error}</p>
                            {loaded?.issues.slice(0, 8).map((issue) => (
                                <code
                                    key={
                                        issue.file + issue.path + issue.message
                                    }
                                >
                                    {issue.file} · {issue.path}: {issue.message}
                                </code>
                            ))}
                            <div className="epochs-error__actions">
                                {loaded?.editable && (
                                    <Link
                                        className="hud-button hud-button--primary"
                                        to="/city2/workshop"
                                    >
                                        🛠️ Мастерская
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    className="hud-button"
                                    onClick={() => window.location.reload()}
                                >
                                    Повторить
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {game && phase === 'ready' && (
                <>
                    <TopBar
                        game={game}
                        speed={speed}
                        onSpeed={setSpeed}
                        muted={muted}
                        onMute={() => {
                            audioRef.current?.unlock();
                            audioRef.current?.setMuted(!muted);
                            setMuted(!muted);
                        }}
                        saveLabel={saveLabel}
                        onBack={() => navigate('/')}
                        onMenu={() => setPanel('menu')}
                        onResearch={() => setPanel('tech')}
                        tester={Boolean(loaded?.editable)}
                        infinite={infinite}
                        fps={fps}
                        onLowerQuality={
                            quality === 'low'
                                ? undefined
                                : () =>
                                      setQuality(
                                          quality === 'high' ? 'medium' : 'low',
                                      )
                        }
                    />

                    <GoalsWidget
                        game={game}
                        collapsed={goalsCollapsed}
                        onToggle={() => setGoalsCollapsed((on) => !on)}
                        onOpen={() => setPanel('goals')}
                    />

                    <CameraControls
                        yaw={yaw}
                        xray={xray}
                        districts={districts}
                        onRotate={(direction) =>
                            rendererRef.current?.setYaw(
                                yaw + (direction * Math.PI) / 2,
                                true,
                            )
                        }
                        onNorth={() => rendererRef.current?.setYaw(0, true)}
                        onTilt={(direction) =>
                            rendererRef.current?.tiltBy(direction * 0.25)
                        }
                        onZoom={(direction) =>
                            rendererRef.current?.zoomBy(
                                direction > 0 ? 1.25 : 0.8,
                            )
                        }
                        onCenter={() => {
                            const center = game.center;

                            rendererRef.current?.centerOn(
                                center ? center.x + 1 : game.map.width / 2,
                                center ? center.y + 1 : game.map.height / 2,
                                true,
                            );
                        }}
                        onXray={toggleXray}
                        onDistricts={() =>
                            setDistricts((on) => {
                                overlayRef.current.showDistricts = !on;

                                return !on;
                            })
                        }
                    />

                    {selected && (
                        <Inspector
                            key={selected.uid}
                            game={game}
                            building={selected}
                            others={others}
                            onNext={() => {
                                const cycle = pickRef.current;

                                if (cycle && cycle.uids.length > 1) {
                                    cycle.index =
                                        (cycle.index + 1) % cycle.uids.length;
                                    selectBuilding(cycle.uids[cycle.index]);
                                    pickRef.current = cycle;
                                }
                            }}
                            onClose={() => selectBuilding(null)}
                            onUpgrade={() => game.upgrade(selected.uid)}
                            onUpgradeAll={() => {
                                const count = game.upgradeAll(
                                    selected.type,
                                    selected.level,
                                );

                                toast(
                                    count
                                        ? `⏫ Улучшено: ${count}`
                                        : 'Не хватает ресурсов',
                                    count ? 'good' : 'bad',
                                );
                            }}
                            onMove={() => {
                                setTool({ kind: 'move', uid: selected.uid });
                                selectBuilding(null);
                            }}
                            onDemolish={() => {
                                if (
                                    window.confirm(
                                        `Снести «${game.nameOf(selected)}»? Вернётся половина стоимости.`,
                                    )
                                ) {
                                    game.demolish(selected.uid);
                                    selectBuilding(null);
                                }
                            }}
                        />
                    )}

                    {npc && (
                        <NpcPanel
                            game={game}
                            npc={npc}
                            following={following}
                            onFollow={() => {
                                followRef.current = following ? null : npc.uid;
                                setFollowing(!following);
                            }}
                            onClose={() => {
                                selectNpc(null);
                                followRef.current = null;
                                setFollowing(false);
                            }}
                        />
                    )}

                    <div className="toasts" aria-live="polite">
                        {toasts.map((item) => (
                            <div
                                key={item.id}
                                className={`toast toast--${item.tone}`}
                            >
                                {item.text}
                            </div>
                        ))}
                    </div>

                    <div className="hud-bottom">
                        {(toolHint || hint) && (
                            <div className="hud-hint">
                                {toolHint}
                                {hint && <b> · {hint}</b>}
                            </div>
                        )}

                        {dockOpen && (
                            <BuildDock
                                game={game}
                                active={activeBuild}
                                levels={levels}
                                onLevel={(type, level) =>
                                    setLevels((map) => ({
                                        ...map,
                                        [type]: level,
                                    }))
                                }
                                onPick={(type, level) => {
                                    setTool({ kind: 'build', type, level });
                                    selectBuilding(null);
                                }}
                                onCollapse={() => setDockOpen(false)}
                            />
                        )}

                        <nav className="toolbar">
                            <button
                                type="button"
                                aria-pressed={dockOpen}
                                onClick={() => setDockOpen((open) => !open)}
                                title="Строительство (B)"
                            >
                                🏗️ <span>Строить</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={
                                    tool.kind === 'build' &&
                                    roadDef?.id === tool.type
                                }
                                onClick={() =>
                                    roadDef &&
                                    setTool(
                                        tool.kind === 'build' &&
                                            tool.type === roadDef.id
                                            ? { kind: 'select' }
                                            : {
                                                  kind: 'build',
                                                  type: roadDef.id,
                                                  level:
                                                      levels[roadDef.id] ??
                                                      game
                                                          .availableLevels(
                                                              roadDef,
                                                          )
                                                          .at(-1) ??
                                                      1,
                                              },
                                    )
                                }
                                title="Дороги (R)"
                            >
                                🛤️ <span>Дорога</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={tool.kind === 'bulldoze'}
                                onClick={() =>
                                    setTool(
                                        tool.kind === 'bulldoze'
                                            ? { kind: 'select' }
                                            : { kind: 'bulldoze' },
                                    )
                                }
                                title="Снос и расчистка (X)"
                            >
                                🧨 <span>Снос</span>
                            </button>
                            <span className="toolbar__sep" />
                            <button
                                type="button"
                                aria-pressed={panel === 'tech'}
                                onClick={() => setPanel('tech')}
                                title="Технологии (T)"
                            >
                                🔬 <span>Наука</span>
                                {!game.state.research && (
                                    <i className="toolbar__dot" />
                                )}
                            </button>
                            <button
                                type="button"
                                aria-pressed={panel === 'bureau'}
                                onClick={() => setPanel('bureau')}
                                title="Бюро архитекторов: чертежи"
                            >
                                📐 <span>Чертежи</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={panel === 'goals'}
                                onClick={() => setPanel('goals')}
                                title="Цели и достижения (G)"
                            >
                                🏆 <span>Цели</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPanel('stats')}
                                title="Статистика"
                            >
                                📊 <span>Статистика</span>
                            </button>
                            <button
                                type="button"
                                className={
                                    game.canAdvance()
                                        ? 'toolbar__epoch toolbar__epoch--ready'
                                        : 'toolbar__epoch'
                                }
                                onClick={() => setPanel('epoch')}
                                title="Новая эпоха"
                            >
                                ⏳{' '}
                                <span>
                                    {game.content.epochs[game.state.epoch + 1]
                                        ? `Эпоха ${game.content.epochs[game.state.epoch + 1].year}`
                                        : 'Эпохи'}
                                </span>
                            </button>
                            {loaded?.editable && (
                                <Link
                                    className="toolbar__link"
                                    to="/city2/workshop"
                                    title="Мастерская: настройки игры"
                                >
                                    🛠️ <span>Мастерская</span>
                                </Link>
                            )}
                        </nav>
                    </div>

                    {panel === 'stats' && (
                        <Stats game={game} onClose={() => setPanel(null)} />
                    )}
                    {panel === 'tech' && (
                        <TechTree game={game} onClose={() => setPanel(null)} />
                    )}
                    {panel === 'bureau' && (
                        <Bureau game={game} onClose={() => setPanel(null)} />
                    )}
                    {panel === 'goals' && (
                        <Goals game={game} onClose={() => setPanel(null)} />
                    )}
                    {panel === 'epoch' && (
                        <EpochPanel
                            game={game}
                            onAdvance={() => {
                                if (game.advanceEpoch().ok) {
                                    setPanel(null);
                                }
                            }}
                            onClose={() => setPanel(null)}
                        />
                    )}
                    {panel === 'menu' && (
                        <Modal title="Меню" onClose={() => setPanel(null)}>
                            <div className="game-menu">
                                <button
                                    type="button"
                                    className="hud-button hud-button--big"
                                    onClick={() =>
                                        save().then(() => setPanel(null))
                                    }
                                >
                                    💾 Сохранить сейчас
                                </button>
                                {loaded?.editable && (
                                    <Link
                                        className="hud-button hud-button--big"
                                        to="/city2/workshop"
                                    >
                                        🛠️ Мастерская
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    className="hud-button hud-button--big"
                                    onClick={() => navigate('/')}
                                >
                                    🎮 Другие игры
                                </button>
                                <button
                                    type="button"
                                    className="hud-button hud-button--big hud-button--danger"
                                    onClick={restart}
                                >
                                    🔄 Начать новый мир
                                </button>
                                <div className="game-menu__quality">
                                    <b>🖥️ Графика</b>
                                    <div
                                        className="hud-speed"
                                        role="group"
                                        aria-label="Качество графики"
                                    >
                                        {(
                                            [
                                                ['low', 'Быстро'],
                                                ['medium', 'Средне'],
                                                ['high', 'Красиво'],
                                            ] as const
                                        ).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                aria-pressed={quality === value}
                                                onClick={() =>
                                                    setQuality(value)
                                                }
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <span>
                                        Сейчас {fps} кадров/с. Если игра
                                        тормозит — выберите «Быстро»: без теней
                                        и с обычной чёткостью.
                                    </span>
                                </div>
                                {loaded?.editable && (
                                    <div className="game-menu__tester">
                                        <b>🧪 Режим тестера</b>
                                        <span>
                                            Виден только редакторам игры.
                                            Скорость ×20 и ×50 — в верхней
                                            панели.
                                        </span>
                                        <label className="game-menu__toggle">
                                            <input
                                                type="checkbox"
                                                checked={infinite}
                                                onChange={(event) =>
                                                    setInfinite(
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                            ♾️ Бесконечные ресурсы — всё
                                            бесплатно, склады всегда полные
                                        </label>
                                        <div>
                                            <button
                                                type="button"
                                                className="hud-button"
                                                onClick={() =>
                                                    game.testerGrant()
                                                }
                                            >
                                                💰 Заполнить ресурсы
                                            </button>
                                            <button
                                                type="button"
                                                className="hud-button"
                                                onClick={() =>
                                                    game.testerFinish()
                                                }
                                            >
                                                ⚡ Достроить всё
                                            </button>
                                            <button
                                                type="button"
                                                className="hud-button"
                                                onClick={() =>
                                                    game.testerResearchAll()
                                                }
                                            >
                                                🔬 Изучить всё в эпохе
                                            </button>
                                            <button
                                                type="button"
                                                className="hud-button"
                                                disabled={!game.epoch.next}
                                                onClick={() => {
                                                    game.testerNextEpoch();
                                                    setPanel(null);
                                                }}
                                            >
                                                ⏭ Следующая эпоха
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="game-menu__keys">
                                    <b>Управление</b>
                                    <span>
                                        Левая кнопка — двигать карту · правая
                                        (или Shift) — вращать и наклонять
                                    </span>
                                    <span>
                                        Колесо / + − — масштаб · Q / E — поворот
                                        · PageUp / PageDown — наклон
                                    </span>
                                    <span>
                                        Клик по зданию ещё раз — выбрать то, что
                                        за ним · V — прозрачные здания
                                    </span>
                                    <span>
                                        B — строить · R — дорога · X — снос · T
                                        — наука · G — цели · Пробел — пауза
                                    </span>
                                </div>
                            </div>
                        </Modal>
                    )}

                    {splash !== null && (
                        <EpochSplash
                            game={game}
                            epoch={splash}
                            onDone={() => setSplash(null)}
                        />
                    )}

                    {conflict && (
                        <Modal
                            title="Мир открыт в другой вкладке"
                            onClose={() => window.location.reload()}
                        >
                            <p className="epoch-panel__lead">
                                Этот мир уже сохранили в другой вкладке или на
                                другом устройстве. Загрузите свежую версию,
                                чтобы не потерять прогресс.
                            </p>
                            <button
                                type="button"
                                className="hud-button hud-button--primary hud-button--big"
                                onClick={() => window.location.reload()}
                            >
                                Загрузить заново
                            </button>
                        </Modal>
                    )}
                </>
            )}
        </div>
    );
}
