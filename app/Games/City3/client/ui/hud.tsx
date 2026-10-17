import type { Game } from '../engine/sim/game';
import { CalendarChip } from './chronicle';
import {
    Bar,
    duration,
    face,
    formatExact,
    formatNumber,
    formatRate,
    MoneyIcon,
} from './common';

/**
 * The bar along the top: the calendar chip (year, era, the live lead over
 * history), clock, the money pill (the only resource on screen, in the
 * current era's face; the coin flips at an era change, the pill turns red
 * in arrears), citizens, research, speed.
 */
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
    onChronicle,
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
    onChronicle: () => void;
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
    const coin = game.content.currencyFace(game.state.epoch);
    const money = game.money;
    const moneyRate = stats.rates[game.content.currency] ?? 0;
    const closed = [...game.buildings.values()].filter(
        (building) => building.mothballed,
    ).length;
    const arrears = stats.arrears || game.state.economy.arrears;
    const closedText = `Казна пуста: законсервировано ${closed} ${closed === 1 ? 'здание' : closed > 1 && closed < 5 ? 'здания' : 'зданий'}`;

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
                <CalendarChip game={game} onOpen={onChronicle} />
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
                    className={`hud-res__item hud-money${arrears ? ' hud-money--arrears' : ''}`}
                    role="status"
                    aria-label={`Деньги: ${formatExact(money)} (${coin.short.toLowerCase()})`}
                    title={`${coin.name}: ${formatExact(money)} · ${formatRate(moneyRate)}\n«${coin.flavor}»`}
                >
                    {/* Keyed by era: the coin flips once when the face changes. */}
                    <span
                        className="hud-res__icon hud-money__coin"
                        key={epoch.id}
                    >
                        <MoneyIcon face={coin} />
                    </span>
                    <span className="hud-res__value">
                        {formatNumber(money)}
                    </span>
                    <span
                        className={`hud-res__rate${moneyRate < 0 ? ' hud-res__rate--down' : ''}`}
                    >
                        {formatRate(moneyRate)}
                    </span>
                    {(arrears || closed > 0) && (
                        <span className="hud-alert" title={closedText}>
                            🔒{closed > 0 ? closed : ''}
                        </span>
                    )}
                </div>

                <div
                    className="hud-res__item"
                    title={`Жители / сколько вместят дома при нынешних услугах и довольстве (мест всего ${formatNumber(stats.housing)}) · работают ${formatNumber(Math.min(stats.workers, stats.jobs))} из ${formatNumber(stats.workers)}, рабочих мест ${formatNumber(stats.jobs)}`}
                >
                    <span className="hud-res__icon">👥</span>
                    <span className="hud-res__value">
                        {formatNumber(Math.floor(game.state.population))}
                        <small>/{formatNumber(Math.floor(stats.target))}</small>
                    </span>
                    <span className="hud-res__rate">
                        {stats.employment < 1
                            ? `рабочих ${Math.round(stats.employment * 100)}%`
                            : `${face(stats.happiness)} ${Math.round(stats.happiness)}`}
                    </span>
                </div>
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
                        title="Режим тестера: всё бесплатно"
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
                                        {formatNumber(progress.current)} /{' '}
                                        {formatNumber(progress.target)}
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
