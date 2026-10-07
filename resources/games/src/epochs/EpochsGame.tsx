import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './epochs.css';
import { GameApiError, gameApi } from '../shared/api';
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
import { Renderer } from './render/renderer';
import type { Overlay } from './render/renderer';
import {
    BuildMenu,
    EpochPanel,
    EpochSplash,
    Inspector,
    Modal,
    NpcPanel,
    Stats,
    TopBar,
} from './ui/panels';

type Tool =
    | { kind: 'select' }
    | { kind: 'build'; type: string }
    | { kind: 'bulldoze' }
    | { kind: 'move'; uid: number };

interface Toast {
    id: number;
    text: string;
    tone: 'info' | 'good' | 'bad';
}

const AUTOSAVE_MS = 20_000;

let toastSeq = 0;

/**
 * "City of Eras": the canvas, the HUD around it, the loop, input, sound
 * and saving. Everything the game is made of comes from the content files.
 */
export default function EpochsGame() {
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
    });
    const toolRef = useRef<Tool>({ kind: 'select' });
    const speedRef = useRef(1);
    const followRef = useRef<number | null>(null);

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
    const [panel, setPanel] = useState<'stats' | 'epoch' | 'menu' | null>(null);
    const [buildOpen, setBuildOpen] = useState(false);
    const [speed, setSpeedState] = useState(1);
    const [muted, setMuted] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [splash, setSplash] = useState<number | null>(null);
    const [saveLabel, setSaveLabel] = useState('');
    const [conflict, setConflict] = useState(false);
    const [hint, setHint] = useState<string | null>(null);

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
        rendererRef.current = new Renderer(canvasRef.current!);
        document.title = 'Город эпох';

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

            const renderer = rendererRef.current!;

            renderer.attach(world);
            renderer.resize();
            renderer.camera.zoom =
                window.innerWidth > 1600
                    ? 1.3
                    : window.innerWidth < 700
                      ? 0.8
                      : 1.05;

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

            const pan = 600 * dt;

            if (keys.has('a') || keys.has('arrowleft')) {
                renderer.pan(pan, 0);
            }

            if (keys.has('d') || keys.has('arrowright')) {
                renderer.pan(-pan, 0);
            }

            if (keys.has('w') || keys.has('arrowup')) {
                renderer.pan(0, pan);
            }

            if (keys.has('s') || keys.has('arrowdown')) {
                renderer.pan(0, -pan);
            }

            if (followRef.current) {
                const npc = game.npcs.get(followRef.current);

                if (npc) {
                    const [sx, sy] = renderer.worldToScreen(npc.x, npc.y);

                    renderer.pan(
                        (renderer.width / 2 - sx) * Math.min(1, dt * 4),
                        (renderer.height / 2 - sy) * Math.min(1, dt * 4),
                    );
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
                rerender();
            }

            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
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
                setBuildOpen(false);
                selectBuilding(null);
            } else if (key === 'b') {
                setBuildOpen((open) => !open);
            } else if (key === 'r') {
                setTool({ kind: 'build', type: 'road' });
            } else if (key === 'x') {
                setTool({ kind: 'bulldoze' });
            } else if (key === '+' || key === '=') {
                renderer.zoomAt(1.15);
            } else if (key === '-') {
                renderer.zoomAt(1 / 1.15);
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
    }, [game, selectBuilding, setSpeed, setTool]);

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
            panning: boolean;
            button: number;
            roadFrom: { x: number; y: number } | null;
        } | null = null;
        let pinch: { distance: number; x: number; y: number } | null = null;

        const local = (event: PointerEvent | MouseEvent) => {
            const box = canvas.getBoundingClientRect();

            return { x: event.clientX - box.left, y: event.clientY - box.top };
        };
        const tileAt = (px: number, py: number) => {
            const world = renderer.screenToWorld(px, py);

            return { x: Math.floor(world.x), y: Math.floor(world.y) };
        };
        const footprintAt = (type: string, px: number, py: number) => {
            const size = game.content.building(type).size;
            const world = renderer.screenToWorld(px, py);

            return {
                x: Math.round(world.x - size.w / 2),
                y: Math.round(world.y - size.h / 2),
            };
        };
        const roadPath = (
            from: { x: number; y: number },
            to: { x: number; y: number },
        ) => {
            const path: { x: number; y: number; ok: boolean }[] = [];
            const sx = Math.sign(to.x - from.x);
            const sy = Math.sign(to.y - from.y);
            const push = (x: number, y: number) =>
                path.push({
                    x,
                    y,
                    ok:
                        game.buildingAt(x, y)?.type === 'road' ||
                        game.canPlace('road', x, y).ok,
                });

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

            if (active.kind === 'build' && active.type !== 'road') {
                const at = footprintAt(active.type, px, py);
                const check = game.canPlace(active.type, at.x, at.y);

                overlay.ghost = { type: active.type, ...at, ok: check.ok };
                setHint(check.ok ? null : (check.reason ?? null));
            } else if (active.kind === 'move') {
                const moving = game.buildings.get(active.uid);

                if (moving) {
                    const at = footprintAt(moving.type, px, py);
                    const check = game.canPlace(
                        moving.type,
                        at.x,
                        at.y,
                        moving.uid,
                    );

                    overlay.ghost = {
                        type: moving.type,
                        ...at,
                        ok: check.ok,
                        moving: moving.uid,
                    };
                    setHint(check.ok ? null : (check.reason ?? null));
                }
            } else if (
                active.kind === 'build' &&
                active.type === 'road' &&
                !drag?.roadFrom
            ) {
                overlay.roadPath = roadPath(hover, hover);
            } else {
                overlay.ghost = null;
            }
        };

        const click = (px: number, py: number) => {
            const active = toolRef.current;

            if (active.kind === 'select') {
                const npc = renderer.pickNpc(px, py);

                if (npc) {
                    selectNpc(npc.uid);
                    audioRef.current?.play('click');

                    return;
                }

                const building = renderer.pickBuilding(px, py);

                selectBuilding(
                    building && building.type !== 'road' ? building.uid : null,
                );

                if (building) {
                    audioRef.current?.play(game.def(building).sounds.select);
                }

                return;
            }

            if (active.kind === 'bulldoze') {
                const { x, y } = tileAt(px, py);
                const building = game.buildingAt(x, y);

                if (building) {
                    game.demolish(building.uid);

                    if (building.uid === overlayRef.current.selectedUid) {
                        selectBuilding(null);
                    }
                } else {
                    game.clear(x, y);
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
                    game.place(active.type, ghost.x, ghost.y).ok &&
                    (def.unique || !game.canAfford(game.buildCost(def)))
                ) {
                    setTool({ kind: 'select' });
                }

                updateHover(px, py);
            }
        };

        const buildRoad = () => {
            for (const step of overlayRef.current.roadPath) {
                if (game.buildingAt(step.x, step.y)?.type === 'road') {
                    continue;
                }

                if (
                    !game.place('road', step.x, step.y).ok &&
                    !game.canAfford(
                        game.buildCost(game.content.building('road')),
                    )
                ) {
                    break;
                }
            }

            overlayRef.current.roadPath = [];
        };

        const onDown = (event: PointerEvent) => {
            audioRef.current?.unlock();
            canvas.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, local(event));

            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];

                pinch = {
                    distance: Math.hypot(a.x - b.x, a.y - b.y),
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
                active.type === 'road'
                    ? tileAt(point.x, point.y)
                    : null;

            drag = { ...point, panning: false, button: event.button, roadFrom };

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
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

                renderer.zoomAt(distance / pinch.distance, mid.x, mid.y);
                renderer.pan(mid.x - pinch.x, mid.y - pinch.y);
                pinch = { distance, ...mid };

                return;
            }

            if (drag?.roadFrom) {
                overlayRef.current.roadPath = roadPath(
                    drag.roadFrom,
                    tileAt(point.x, point.y),
                );

                return;
            }

            if (
                drag &&
                (drag.panning ||
                    Math.hypot(point.x - drag.x, point.y - drag.y) > 5)
            ) {
                renderer.pan(point.x - drag.x, point.y - drag.y);
                drag.x = point.x;
                drag.y = point.y;
                drag.panning = true;
                followRef.current = null;
                canvas.style.cursor = 'grabbing';

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
                buildRoad();

                return;
            }

            if (finished.panning) {
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

            renderer.zoomAt(
                event.deltaY < 0 ? 1.12 : 1 / 1.12,
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
    }, [game, selectBuilding, selectNpc, setTool]);

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
    const activeBuild = tool.kind === 'build' ? tool.type : null;
    const toolHint =
        tool.kind === 'build' && tool.type === 'road'
            ? 'Тяните мышью, чтобы проложить дорогу. Esc или ПКМ — отмена.'
            : tool.kind === 'build' && game
              ? `Строим: ${game.content.nameOf(game.content.building(tool.type), game.state.epoch)}. Клик — поставить, Esc — отмена.`
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
                                        to="/epochs/workshop"
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
                    />

                    {selected && (
                        <Inspector
                            game={game}
                            building={selected}
                            onClose={() => selectBuilding(null)}
                            onUpgrade={() => game.upgrade(selected.uid)}
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

                        {buildOpen && (
                            <BuildMenu
                                game={game}
                                active={activeBuild}
                                onPick={(type) => {
                                    setTool({ kind: 'build', type });
                                    selectBuilding(null);
                                }}
                                onClose={() => setBuildOpen(false)}
                            />
                        )}

                        <nav className="toolbar">
                            <button
                                type="button"
                                aria-pressed={buildOpen}
                                onClick={() => setBuildOpen((open) => !open)}
                                title="Строительство (B)"
                            >
                                🏗️ <span>Строить</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={activeBuild === 'road'}
                                onClick={() =>
                                    setTool(
                                        activeBuild === 'road'
                                            ? { kind: 'select' }
                                            : { kind: 'build', type: 'road' },
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
                                    to="/epochs/workshop"
                                    title="Мастерская: настройки игры"
                                >
                                    🛠️ <span>Мастерская</span>
                                </Link>
                            )}
                            <span className="toolbar__sep" />
                            <button
                                type="button"
                                onClick={() => rendererRef.current?.zoomAt(1.2)}
                                title="Приблизить (+)"
                            >
                                ＋
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    rendererRef.current?.zoomAt(1 / 1.2)
                                }
                                title="Отдалить (−)"
                            >
                                －
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const center = game.center;

                                    rendererRef.current?.centerOn(
                                        center ? center.x + 1 : 32,
                                        center ? center.y + 1 : 32,
                                    );
                                }}
                                title="К центру города"
                            >
                                🎯
                            </button>
                        </nav>
                    </div>

                    {panel === 'stats' && (
                        <Stats game={game} onClose={() => setPanel(null)} />
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
                                        to="/epochs/workshop"
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
                                <div className="game-menu__keys">
                                    <b>Управление</b>
                                    <span>
                                        Перетаскивание / WASD / стрелки —
                                        двигать карту
                                    </span>
                                    <span>Колесо / + − — масштаб</span>
                                    <span>
                                        Клик по жителю — его имя, работа, мысли
                                    </span>
                                    <span>
                                        B — строить · R — дорога · X — снос ·
                                        Пробел — пауза
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
