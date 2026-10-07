import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameApiError, gameApi } from '../shared/api';
import { usePlaytime } from '../shared/usePlaytime';
import { BUILDING, EPOCHS, TECHS } from './engine/data';
import { CENTER } from './engine/map';
import { City, SAVE_VERSION } from './engine/sim';
import type { CityState } from './engine/sim';
import { Renderer } from './render/renderer';
import type { Overlay } from './render/renderer';
import {
    BuildMenu,
    EpochPanel,
    EpochSplash,
    Goals,
    Inspector,
    Modal,
    Stats,
    TechTree,
    TopBar,
} from './ui/panels';

type Tool =
    | { kind: 'select' }
    | { kind: 'build'; type: string }
    | { kind: 'bulldoze' }
    | { kind: 'move'; id: number };

type Panel = 'tech' | 'stats' | 'epoch' | 'menu' | null;

interface Toast {
    id: number;
    text: string;
    tone: 'info' | 'good' | 'bad';
}

interface SaveResponse {
    revision: number;
    state: CityState;
    saved_at: string | null;
}

const AUTOSAVE_MS = 20_000;

let toastId = 0;

/**
 * "City Chronicle": the canvas with the city, the HUD around it, the game
 * loop, mouse/keyboard/touch control and saving to /api/games/city/save.
 */
export default function CityGame() {
    usePlaytime('city');
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cityRef = useRef<City | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const revisionRef = useRef<number | null>(null);
    const savedCityRevision = useRef(0);
    const overlayRef = useRef<Overlay>({
        hover: null,
        ghost: null,
        roadPath: [],
        selectedId: null,
        bulldoze: false,
    });
    const toolRef = useRef<Tool>({ kind: 'select' });
    const speedRef = useRef(1);
    const conflictRef = useRef(false);

    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(
        'loading',
    );
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const [tool, setToolState] = useState<Tool>({ kind: 'select' });
    const [selectedId, setSelectedIdState] = useState<number | null>(null);
    const [panel, setPanel] = useState<Panel>(null);
    const [buildOpen, setBuildOpen] = useState(false);
    const [speed, setSpeedState] = useState(1);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [splash, setSplash] = useState<number | null>(null);
    const [saveLabel, setSaveLabel] = useState('');
    const [conflict, setConflict] = useState(false);
    const [goalsCollapsed, setGoalsCollapsed] = useState(false);
    const [hint, setHint] = useState<string | null>(null);

    const [city, setCity] = useState<City | null>(null);

    const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
        const id = ++toastId;

        setToasts((list) => [...list.slice(-3), { id, text, tone }]);
        window.setTimeout(
            () => setToasts((list) => list.filter((item) => item.id !== id)),
            tone === 'bad' ? 7000 : 4500,
        );
    }, []);

    const setTool = useCallback((next: Tool) => {
        toolRef.current = next;
        overlayRef.current.ghost = null;
        overlayRef.current.roadPath = [];
        overlayRef.current.bulldoze = next.kind === 'bulldoze';
        setToolState(next);
    }, []);

    const select = useCallback((id: number | null) => {
        overlayRef.current.selectedId = id;
        setSelectedIdState(id);
    }, []);

    const setSpeed = useCallback((value: number) => {
        speedRef.current = value;
        setSpeedState(value);
    }, []);

    // ——————————————————————————————————————— Saving

    const save = useCallback(
        async (keepalive = false) => {
            const current = cityRef.current;

            if (!current || conflictRef.current) {
                return;
            }

            const state = current.serialize();

            savedCityRevision.current = current.revision;
            setSaveLabel('💾 Сохранение…');

            try {
                const result = await gameApi<{ revision: number }>(
                    'city/save',
                    {
                        method: 'PUT',
                        keepalive,
                        body: {
                            revision: revisionRef.current,
                            epoch: state.epoch,
                            year: Math.floor(state.year),
                            population: Math.floor(state.population),
                            score: current.score(),
                            state,
                        },
                    },
                );

                revisionRef.current = result.revision;
                setSaveLabel('✓ Сохранено');
            } catch (error) {
                if (error instanceof GameApiError && error.status === 409) {
                    conflictRef.current = true;
                    setConflict(true);
                    setSpeed(0);
                } else {
                    setSaveLabel('⚠ Не сохранено');
                    savedCityRevision.current = -1;
                }
            }
        },
        [setSpeed],
    );

    // ——————————————————————————————————————— Loading

    const start = useCallback((loaded: City) => {
        cityRef.current = loaded;
        setCity(loaded);

        const renderer = rendererRef.current!;

        renderer.setCity(loaded);
        renderer.resize();
        renderer.camera.zoom =
            window.innerWidth > 1600 ? 1.25 : window.innerWidth < 700 ? 0.8 : 1;
        renderer.centerOn(CENTER + 1, CENTER + 1);
        savedCityRevision.current = loaded.revision;
        setPhase('ready');
    }, []);

    useEffect(() => {
        rendererRef.current = new Renderer(canvasRef.current!);
        document.title = 'Летопись города';

        let cancelled = false;

        gameApi<SaveResponse | null>('city/save')
            .then((saved) => {
                if (cancelled) {
                    return;
                }

                if (saved?.state && saved.state.version === SAVE_VERSION) {
                    revisionRef.current = saved.revision;

                    const { city: loaded, away } = City.load(saved.state);

                    start(loaded);

                    if (away && away.seconds >= 60) {
                        toast(
                            `🌙 Пока вас не было (${Math.round(away.seconds / 60)} мин): ${away.population >= 0 ? '+' : ''}${away.population} жителей, ${away.gold >= 0 ? '+' : ''}${away.gold} золота`,
                            'good',
                        );
                    }
                } else {
                    revisionRef.current = saved?.revision ?? null;
                    start(City.create());
                    toast(
                        '🏕️ 1000 год. Несколько семей ждут, когда вы проложите первую дорогу.',
                        'info',
                    );
                }
            })
            .catch(() => !cancelled && setPhase('error'));

        return () => {
            cancelled = true;
        };
    }, [start, toast]);

    // ——————————————————————————————————————— Game loop

    useEffect(() => {
        if (phase !== 'ready') {
            return;
        }

        const renderer = rendererRef.current!;
        const keys = new Set<string>();
        let last = performance.now();
        let accumulator = 0;
        let lastUi = 0;
        let frame = 0;

        const loop = (now: number) => {
            const current = cityRef.current!;
            const dt = Math.min(0.1, (now - last) / 1000);

            last = now;
            accumulator += dt * speedRef.current;

            while (accumulator >= 1) {
                current.tick(1);
                accumulator -= 1;
            }

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

            for (const event of current.events.splice(0)) {
                renderer.handle(event);

                if (event.type === 'toast') {
                    toast(event.text, event.tone);
                } else if (event.type === 'goal') {
                    toast(event.text, 'good');
                } else if (event.type === 'epoch') {
                    setSplash(event.epoch);
                }
            }

            renderer.frame(dt, overlayRef.current);

            if (now - lastUi > 250) {
                lastUi = now;
                rerender();
            }

            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement) {
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
                select(null);
            } else if (key === 'b') {
                setBuildOpen((open) => !open);
            } else if (key === 'r') {
                setTool({ kind: 'build', type: 'road' });
            } else if (key === 'x') {
                setTool({ kind: 'bulldoze' });
            } else if (key === 't') {
                setPanel((open) => (open === 'tech' ? null : 'tech'));
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
    }, [phase, select, setSpeed, setTool, toast]);

    // Autosave, and a last save when the tab is hidden or the page left.
    useEffect(() => {
        if (phase !== 'ready') {
            return;
        }

        const dirty = () =>
            cityRef.current !== null &&
            cityRef.current.revision !== savedCityRevision.current;
        const timer = window.setInterval(() => dirty() && save(), AUTOSAVE_MS);
        const onHide = () =>
            document.visibilityState === 'hidden' && dirty() && save(true);

        document.addEventListener('visibilitychange', onHide);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onHide);

            if (dirty()) {
                save(true);
            }
        };
    }, [phase, save]);

    // ——————————————————————————————————————— Pointer control

    useEffect(() => {
        if (phase !== 'ready') {
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

        const local = (event: PointerEvent) => {
            const box = canvas.getBoundingClientRect();

            return { x: event.clientX - box.left, y: event.clientY - box.top };
        };

        const tileAt = (px: number, py: number) => {
            const world = renderer.screenToWorld(px, py);

            return {
                x: Math.floor(world.x),
                y: Math.floor(world.y),
                fx: world.x,
                fy: world.y,
            };
        };

        const footprintAt = (type: string, px: number, py: number) => {
            const size = BUILDING[type].size;
            const world = renderer.screenToWorld(px, py);

            return {
                x: Math.round(world.x - size / 2),
                y: Math.round(world.y - size / 2),
            };
        };

        const roadPath = (
            from: { x: number; y: number },
            to: { x: number; y: number },
        ) => {
            const current = cityRef.current!;
            const path: { x: number; y: number; ok: boolean }[] = [];
            const stepX = Math.sign(to.x - from.x);
            const stepY = Math.sign(to.y - from.y);
            const push = (x: number, y: number) => {
                const existing = current.buildingAt(x, y)?.type === 'road';

                path.push({
                    x,
                    y,
                    ok: existing || current.canPlace('road', x, y).ok,
                });
            };

            for (let x = from.x; ; x += stepX) {
                push(x, from.y);

                if (x === to.x) {
                    break;
                }
            }

            for (let y = from.y + stepY; stepY !== 0; y += stepY) {
                push(to.x, y);

                if (y === to.y) {
                    break;
                }
            }

            return path;
        };

        const updateHover = (px: number, py: number) => {
            const current = cityRef.current!;
            const active = toolRef.current;
            const overlay = overlayRef.current;
            const hover = tileAt(px, py);

            overlay.hover = { x: hover.x, y: hover.y };

            if (active.kind === 'build' && active.type !== 'road') {
                const at = footprintAt(active.type, px, py);
                const check = current.canPlace(active.type, at.x, at.y);

                overlay.ghost = { type: active.type, ...at, ok: check.ok };
                setHint(check.ok ? null : (check.reason ?? null));
            } else if (active.kind === 'move') {
                const moving = current.byId.get(active.id);

                if (moving) {
                    const at = footprintAt(moving.type, px, py);
                    const check = current.canPlace(
                        moving.type,
                        at.x,
                        at.y,
                        moving.id,
                    );

                    overlay.ghost = {
                        type: moving.type,
                        ...at,
                        ok: check.ok,
                        moving: moving.id,
                    };
                    setHint(check.ok ? null : (check.reason ?? null));
                }
            } else if (
                active.kind === 'build' &&
                active.type === 'road' &&
                !drag?.roadFrom
            ) {
                const check = current.canPlace('road', hover.x, hover.y);

                overlay.roadPath = [
                    {
                        x: hover.x,
                        y: hover.y,
                        ok:
                            check.ok ||
                            current.buildingAt(hover.x, hover.y)?.type ===
                                'road',
                    },
                ];
            } else {
                overlay.ghost = null;
            }
        };

        const click = (px: number, py: number) => {
            const current = cityRef.current!;
            const active = toolRef.current;

            if (active.kind === 'select') {
                const building = renderer.pickBuilding(px, py);

                select(
                    building && building.type !== 'road' ? building.id : null,
                );

                return;
            }

            if (active.kind === 'bulldoze') {
                const { x, y } = tileAt(px, py);
                const building = current.buildingAt(x, y);
                const result = building
                    ? current.demolish(building.id)
                    : current.clearTile(x, y);

                if (!result.ok && result.reason) {
                    toast(result.reason, 'bad');
                }

                if (building && building.id === overlayRef.current.selectedId) {
                    select(null);
                }

                return;
            }

            if (active.kind === 'move') {
                const ghost = overlayRef.current.ghost;

                if (ghost) {
                    const result = current.move(active.id, ghost.x, ghost.y);

                    if (result.ok) {
                        setTool({ kind: 'select' });
                        select(active.id);
                    } else if (result.reason) {
                        toast(result.reason, 'bad');
                    }
                }

                return;
            }

            if (active.kind === 'build' && active.type !== 'road') {
                const ghost = overlayRef.current.ghost;

                if (!ghost) {
                    return;
                }

                const result = current.place(active.type, ghost.x, ghost.y);

                if (!result.ok && result.reason) {
                    toast(result.reason, 'bad');
                } else if (
                    result.ok &&
                    (BUILDING[active.type].unique ||
                        !current.canAfford(
                            current.buildCost(BUILDING[active.type]),
                        ))
                ) {
                    setTool({ kind: 'select' });
                }

                updateHover(px, py);
            }
        };

        const buildRoad = () => {
            const current = cityRef.current!;
            let built = 0;
            let reason: string | undefined;

            for (const step of overlayRef.current.roadPath) {
                if (current.buildingAt(step.x, step.y)?.type === 'road') {
                    continue;
                }

                const result = current.place('road', step.x, step.y);

                if (result.ok) {
                    built++;
                } else {
                    reason ??= result.reason;

                    if (reason?.startsWith('Не хватает')) {
                        break;
                    }
                }
            }

            if (reason && built === 0) {
                toast(reason, 'bad');
            }

            overlayRef.current.roadPath = [];
        };

        const onDown = (event: PointerEvent) => {
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
                overlayRef.current.roadPath = [];

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

            drag = {
                ...point,
                panning: false,
                button: event.button,
                roadFrom: roadFrom ? { x: roadFrom.x, y: roadFrom.y } : null,
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
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

                renderer.zoomAt(distance / pinch.distance, mid.x, mid.y);
                renderer.pan(mid.x - pinch.x, mid.y - pinch.y);
                pinch = { distance, ...mid };

                return;
            }

            if (drag) {
                const moved = Math.hypot(point.x - drag.x, point.y - drag.y);

                if (drag.roadFrom) {
                    const at = tileAt(point.x, point.y);

                    overlayRef.current.roadPath = roadPath(drag.roadFrom, {
                        x: at.x,
                        y: at.y,
                    });

                    return;
                }

                if (drag.panning || moved > 5) {
                    renderer.pan(point.x - drag.x, point.y - drag.y);
                    drag.x = point.x;
                    drag.y = point.y;
                    drag.panning = true;
                    canvas.style.cursor = 'grabbing';

                    return;
                }
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

                return;
            }

            if (finished.button === 0) {
                click(point.x, point.y);
            }
        };

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();

            const box = canvas.getBoundingClientRect();

            renderer.zoomAt(
                event.deltaY < 0 ? 1.12 : 1 / 1.12,
                event.clientX - box.left,
                event.clientY - box.top,
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
    }, [phase, select, setTool, toast]);

    // ——————————————————————————————————————— Actions from the HUD

    const act = (result: { ok: boolean; reason?: string }) => {
        if (!result.ok && result.reason) {
            toast(result.reason, 'bad');
        }

        rerender();
    };

    const advance = () => {
        const current = cityRef.current!;
        const result = current.advanceEpoch();

        act(result);

        if (result.ok) {
            setPanel(null);
            save();
        }
    };

    const restart = async () => {
        if (
            !window.confirm(
                'Начать новый город с 1000 года? Текущий город будет удалён.',
            )
        ) {
            return;
        }

        await gameApi('city/save', { method: 'DELETE' }).catch(() => null);
        revisionRef.current = null;
        select(null);
        setTool({ kind: 'select' });
        setPanel(null);
        start(City.create());
        save();
    };

    const selected = city && selectedId ? city.byId.get(selectedId) : undefined;
    const activeBuild = tool.kind === 'build' ? tool.type : null;
    const epoch = city?.state.epoch ?? 0;

    const toolHint =
        tool.kind === 'build' && tool.type === 'road'
            ? 'Тяните мышью, чтобы проложить дорогу. Esc или ПКМ — отмена.'
            : tool.kind === 'build'
              ? `Строим: ${city ? BUILDING[tool.type].name : ''}. Клик — поставить, Esc или ПКМ — отмена.`
              : tool.kind === 'bulldoze'
                ? 'Снос: клик по зданию или дороге (вернётся половина стоимости), по лесу или скале — расчистить.'
                : tool.kind === 'move'
                  ? 'Выберите новое место для здания. Esc — отмена.'
                  : null;

    return (
        <div className="city" data-epoch={epoch}>
            <canvas
                ref={canvasRef}
                className={`city__canvas${tool.kind !== 'select' ? ' city__canvas--tool' : ''}`}
            />

            {phase === 'loading' && (
                <div className="city__loading">Загружаем ваш город…</div>
            )}
            {phase === 'error' && (
                <div className="city__loading">
                    Не удалось загрузить город.{' '}
                    <button
                        type="button"
                        className="hud-button"
                        onClick={() => window.location.reload()}
                    >
                        Повторить
                    </button>
                </div>
            )}

            {city && phase === 'ready' && (
                <>
                    <TopBar
                        city={city}
                        speed={speed}
                        onSpeed={setSpeed}
                        saveLabel={saveLabel}
                        onBack={() => navigate('/')}
                        onMenu={() => setPanel('menu')}
                    />

                    <Goals
                        city={city}
                        collapsed={goalsCollapsed}
                        onToggle={() => setGoalsCollapsed((value) => !value)}
                    />

                    {selected && (
                        <Inspector
                            city={city}
                            building={selected}
                            onClose={() => select(null)}
                            onUpgrade={() => act(city.upgrade(selected.id))}
                            onMove={() => {
                                setTool({ kind: 'move', id: selected.id });
                                select(null);
                            }}
                            onDemolish={() => {
                                if (
                                    window.confirm(
                                        `Снести «${city.nameOf(selected)}»? Вернётся половина стоимости.`,
                                    )
                                ) {
                                    act(city.demolish(selected.id));
                                    select(null);
                                }
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
                                {hint && tool.kind !== 'select' && (
                                    <b> · {hint}</b>
                                )}
                            </div>
                        )}

                        {buildOpen && (
                            <BuildMenu
                                city={city}
                                active={activeBuild}
                                onPick={(type) => {
                                    setTool({ kind: 'build', type });
                                    select(null);
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
                                onClick={() => setPanel('tech')}
                                title="Технологии (T)"
                            >
                                🔬 <span>Технологии</span>
                                {canResearchSomething(city) && (
                                    <i className="toolbar__dot" />
                                )}
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
                                    city.canAdvance()
                                        ? 'toolbar__epoch toolbar__epoch--ready'
                                        : 'toolbar__epoch'
                                }
                                onClick={() => setPanel('epoch')}
                                title="Переход в новую эпоху"
                            >
                                ⏳{' '}
                                <span>
                                    {EPOCHS[epoch + 1]
                                        ? `Эпоха ${EPOCHS[epoch + 1].year}`
                                        : 'Эпохи'}
                                </span>
                            </button>
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
                                onClick={() =>
                                    rendererRef.current?.centerOn(
                                        CENTER + 1,
                                        CENTER + 1,
                                    )
                                }
                                title="К центру города"
                            >
                                🎯
                            </button>
                        </nav>
                    </div>

                    {panel === 'tech' && (
                        <TechTree
                            city={city}
                            onResearch={(id) => act(city.research(id))}
                            onClose={() => setPanel(null)}
                        />
                    )}
                    {panel === 'stats' && (
                        <Stats city={city} onClose={() => setPanel(null)} />
                    )}
                    {panel === 'epoch' && (
                        <EpochPanel
                            city={city}
                            onAdvance={advance}
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
                                    🔄 Начать заново
                                </button>
                                <div className="game-menu__keys">
                                    <b>Управление</b>
                                    <span>
                                        Перетаскивание / WASD / стрелки —
                                        двигать карту
                                    </span>
                                    <span>Колесо / + − — масштаб</span>
                                    <span>
                                        B — строить · R — дорога · X — снос · T
                                        — технологии
                                    </span>
                                    <span>Пробел — пауза · Esc — отмена</span>
                                </div>
                            </div>
                        </Modal>
                    )}

                    {splash !== null && (
                        <EpochSplash
                            epoch={splash}
                            onDone={() => setSplash(null)}
                        />
                    )}

                    {conflict && (
                        <Modal
                            title="Город открыт в другой вкладке"
                            onClose={() => window.location.reload()}
                        >
                            <p className="epoch-panel__lead">
                                Этот город уже сохранили в другой вкладке или на
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

function canResearchSomething(city: City): boolean {
    return TECHS.some(
        (tech) =>
            city.techState(tech.id) === 'available' &&
            city.state.res.science >= tech.cost,
    );
}
