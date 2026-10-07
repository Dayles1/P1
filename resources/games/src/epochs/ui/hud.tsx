import type { Game } from '../engine/sim/game';
import { Bar, compact, duration, face, perMinute } from './common';

/** The bar along the top: year and era, clock, resources, people, research, speed. */
export function TopBar({
    game,
    speed,
    onSpeed,
    muted,
    onMute,
    saveLabel,
    onBack,
    onMenu,
    onResearch,
    tester,
    infinite,
    fps,
    onLowerQuality,
}: {
    game: Game;
    speed: number;
    onSpeed: (speed: number) => void;
    muted: boolean;
    onMute: () => void;
    saveLabel: string;
    onBack: () => void;
    onMenu: () => void;
    onResearch: () => void;
    /** Testers get faster speeds. */
    tester: boolean;
    infinite: boolean;
    fps: number;
    /** Offered when the game runs slowly; undefined at the lowest quality. */
    onLowerQuality?: () => void;
}) {
    const epoch = game.epoch;
    const light = game.clock.light(game.state.time);
    const stats = game.stats;
    const research = game.state.research;
    const tech = research ? game.content.tech(research.id) : undefined;

    return (
        <header className="hud-top">
            <div className="hud-top__left">
                <button
                    type="button"
                    className="hud-icon"
                    onClick={onBack}
                    title="К списку игр"
                >
                    ←
                </button>
                <div className="hud-year" title={epoch.tagline}>
                    <strong>{Math.floor(game.state.year)} г.</strong>
                    <span>{epoch.name}</span>
                </div>
                <div
                    className="hud-clock"
                    title={`${light.phase} · ${game.season.name} · ${game.weather?.name ?? ''}`}
                >
                    <strong>{game.clock.clockText(game.state.time)}</strong>
                    <span>
                        {game.season.icon} {game.weather?.icon} день{' '}
                        {game.clock.day(game.state.time) + 1}
                    </span>
                </div>
            </div>

            <div className="hud-res">
                <div
                    className="hud-res__item"
                    title={`Жители / мест в домах · работают ${Math.floor(Math.min(stats.workers, stats.jobs))} из ${Math.floor(stats.workers)}, рабочих мест ${stats.jobs}`}
                >
                    <span className="hud-res__icon">👥</span>
                    <span className="hud-res__value">
                        {compact(game.state.population)}
                        <small>/{compact(stats.housing)}</small>
                    </span>
                    <span className="hud-res__rate">
                        {stats.employment < 1
                            ? `рабочих ${Math.round(stats.employment * 100)}%`
                            : `${face(stats.happiness)} ${Math.round(stats.happiness)}`}
                    </span>
                </div>

                {(stats.powerDemand > 0 || stats.powerSupply > 0) && (
                    <div
                        className="hud-res__item"
                        title="Энергия: выработка / потребление"
                    >
                        <span className="hud-res__icon">⚡</span>
                        <span className="hud-res__value">
                            {compact(stats.powerSupply)}
                            <small>/{compact(stats.powerDemand)}</small>
                        </span>
                        <span
                            className={`hud-res__rate${stats.powerSupply < stats.powerDemand ? ' hud-res__rate--down' : ''}`}
                        >
                            энергия
                        </span>
                    </div>
                )}

                {game.visibleResources().map((resource) => {
                    const value = game.state.resources[resource.id] ?? 0;
                    const rate = stats.rates[resource.id] ?? 0;
                    const cap = stats.caps[resource.id];
                    const full = resource.capped && value >= cap - 0.5;

                    return (
                        <div
                            key={resource.id}
                            className={`hud-res__item${full ? ' hud-res__item--full' : ''}`}
                            title={`${resource.name}${resource.capped ? ` · склад ${compact(cap)}` : ''}\n${resource.description}`}
                        >
                            <span className="hud-res__icon">
                                {resource.icon}
                            </span>
                            <span className="hud-res__value">
                                {compact(value)}
                                {resource.capped && (
                                    <small>/{compact(cap)}</small>
                                )}
                            </span>
                            <span
                                className={`hud-res__rate${rate < -0.001 ? ' hud-res__rate--down' : ''}`}
                            >
                                {Math.abs(rate) < 0.0005
                                    ? '·'
                                    : perMinute(rate)}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="hud-top__right">
                <button
                    type="button"
                    className={`hud-research${research ? ' hud-research--on' : ''}`}
                    onClick={onResearch}
                    title="Технологии (T)"
                >
                    <span className="hud-research__icon">
                        {tech?.icon ?? '🔬'}
                    </span>
                    {research && tech ? (
                        <span className="hud-research__body">
                            <b>{tech.name}</b>
                            <Bar
                                value={
                                    (game.state.time - research.start) /
                                    Math.max(1, research.end - research.start)
                                }
                                tone="accent"
                            />
                            <small>
                                {duration(research.end - game.state.time)}
                            </small>
                        </span>
                    ) : (
                        <span className="hud-research__body">
                            <b>Наука</b>
                            <small>выберите исследование</small>
                        </span>
                    )}
                </button>
                <div className="hud-speed" role="group" aria-label="Скорость">
                    {[
                        [0, '⏸'],
                        [1, '▶'],
                        [2, '⏩'],
                        [5, '⏭'],
                        ...(tester
                            ? [
                                  [20, '×20'],
                                  [50, '×50'],
                              ]
                            : []),
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={speed === value}
                            onClick={() => onSpeed(value as number)}
                            title={
                                value ? `Скорость ×${value}` : 'Пауза (пробел)'
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="hud-icon"
                    onClick={onMute}
                    title={muted ? 'Включить звук' : 'Выключить звук'}
                >
                    {muted ? '🔇' : '🔊'}
                </button>
                {infinite && (
                    <span
                        className="hud-tester"
                        title="Режим тестера: бесконечные ресурсы"
                    >
                        ♾️
                    </span>
                )}
                {fps < 25 && onLowerQuality && (
                    <button
                        type="button"
                        className="hud-slow"
                        onClick={onLowerQuality}
                        title="Игра тормозит — снизить качество графики"
                    >
                        🐢 {fps} к/с
                    </button>
                )}
                <span className="hud-save">{saveLabel}</span>
                <button
                    type="button"
                    className="hud-icon"
                    onClick={onMenu}
                    title="Меню"
                >
                    ☰
                </button>
            </div>
        </header>
    );
}

/** The three open goals nearest to done, under the top bar. */
export function GoalsWidget({
    game,
    collapsed,
    onToggle,
    onOpen,
}: {
    game: Game;
    collapsed: boolean;
    onToggle: () => void;
    onOpen: () => void;
}) {
    const open = game.openGoals().slice(0, 3);
    const done = game.state.achievements.length;

    return (
        <aside
            className={`goals-widget${collapsed ? ' goals-widget--collapsed' : ''}`}
        >
            <header>
                <button
                    type="button"
                    onClick={onOpen}
                    title="Все цели и достижения (G)"
                >
                    🏆 Цели{' '}
                    <small>
                        {done} / {game.content.goals.length}
                    </small>
                </button>
                <button
                    type="button"
                    className="goals-widget__toggle"
                    onClick={onToggle}
                    title={collapsed ? 'Показать' : 'Свернуть'}
                >
                    {collapsed ? '▾' : '▴'}
                </button>
            </header>
            {!collapsed && (
                <ul>
                    {open.map((goal) => {
                        const progress = game.goalProgress(goal);

                        return (
                            <li key={goal.id} title={goal.description}>
                                <span className="goals-widget__icon">
                                    {goal.icon}
                                </span>
                                <span className="goals-widget__body">
                                    <b>{goal.name}</b>
                                    <Bar
                                        value={
                                            progress.current / progress.target
                                        }
                                        tone="good"
                                    />
                                    <small>
                                        {compact(progress.current)} /{' '}
                                        {compact(progress.target)}
                                    </small>
                                </span>
                            </li>
                        );
                    })}
                    {open.length === 0 && (
                        <li className="goals-widget__empty">
                            Все цели этой эпохи выполнены
                        </li>
                    )}
                </ul>
            )}
        </aside>
    );
}

/** Rotate / tilt / zoom buttons and a compass that turns back to north. */
export function CameraControls({
    yaw,
    xray,
    districts,
    onRotate,
    onNorth,
    onTilt,
    onZoom,
    onCenter,
    onXray,
    onDistricts,
}: {
    yaw: number;
    xray: boolean;
    districts: boolean;
    onRotate: (direction: 1 | -1) => void;
    onNorth: () => void;
    onTilt: (direction: 1 | -1) => void;
    onZoom: (direction: 1 | -1) => void;
    onCenter: () => void;
    onXray: () => void;
    onDistricts: () => void;
}) {
    return (
        <div className="camera-controls" aria-label="Камера">
            <button
                type="button"
                className="camera-controls__compass"
                onClick={onNorth}
                title="На север"
            >
                <span style={{ transform: `rotate(${-yaw}rad)` }}>⬆</span>
                <small>С</small>
            </button>
            <div className="camera-controls__row">
                <button
                    type="button"
                    onClick={() => onRotate(-1)}
                    title="Повернуть влево (Q)"
                >
                    ⟲
                </button>
                <button
                    type="button"
                    onClick={() => onRotate(1)}
                    title="Повернуть вправо (E)"
                >
                    ⟳
                </button>
            </div>
            <div className="camera-controls__row">
                <button
                    type="button"
                    onClick={() => onTilt(1)}
                    title="Сверху (PageUp)"
                >
                    ⤒
                </button>
                <button
                    type="button"
                    onClick={() => onTilt(-1)}
                    title="Сбоку (PageDown)"
                >
                    ⤓
                </button>
            </div>
            <div className="camera-controls__row">
                <button
                    type="button"
                    onClick={() => onZoom(1)}
                    title="Ближе (+)"
                >
                    ＋
                </button>
                <button
                    type="button"
                    onClick={() => onZoom(-1)}
                    title="Дальше (−)"
                >
                    －
                </button>
            </div>
            <button
                type="button"
                onClick={onCenter}
                title="К центру города (Home)"
            >
                🎯
            </button>
            <button
                type="button"
                aria-pressed={xray}
                onClick={onXray}
                title="Прозрачные здания — видно то, что позади (V)"
            >
                👁
            </button>
            <button
                type="button"
                aria-pressed={districts}
                onClick={onDistricts}
                title="Показать округа"
            >
                🗺️
            </button>
        </div>
    );
}
