import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Amounts, Category, Effects } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import type { BuildingState, NpcState } from '../engine/sim/state';

export const CATEGORY_NAMES: Record<Category, { name: string; icon: string }> =
    {
        housing: { name: 'Жильё', icon: '🏠' },
        food: { name: 'Еда', icon: '🌾' },
        resources: { name: 'Добыча', icon: '⛏️' },
        industry: { name: 'Производство', icon: '⚒️' },
        trade: { name: 'Торговля', icon: '💰' },
        civic: { name: 'Город', icon: '⛪' },
        infrastructure: { name: 'Инфраструктура', icon: '🛤️' },
    };

export function compact(value: number): string {
    const n = Math.floor(value);

    if (!Number.isFinite(n)) {
        return '∞';
    }

    if (Math.abs(n) < 1000) {
        return String(n);
    }

    if (Math.abs(n) < 1_000_000) {
        return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    }

    return `${(n / 1_000_000).toFixed(1)}M`;
}

export function perMinute(rate: number): string {
    const value = rate * 60;
    const abs = Math.abs(value);
    const text =
        abs >= 1000
            ? compact(abs)
            : abs >= 10
              ? String(Math.round(abs))
              : String(Math.round(abs * 10) / 10);

    return `${value >= 0 ? '+' : '−'}${text}/мин`;
}

export function face(value: number): string {
    return value >= 80
        ? '😄'
        : value >= 60
          ? '🙂'
          : value >= 40
            ? '😐'
            : value >= 25
              ? '🙁'
              : '😠';
}

export function CostLine({ game, cost }: { game: Game; cost: Amounts }) {
    return (
        <span className="cost">
            {Object.entries(cost).map(([id, amount]) => (
                <span
                    key={id}
                    className={
                        (game.state.resources[id] ?? 0) >= amount
                            ? 'cost__item'
                            : 'cost__item cost__item--short'
                    }
                >
                    {game.content.resource(id)?.icon ?? id} {compact(amount)}
                </span>
            ))}
        </span>
    );
}

// ———————————————————————————————————————— Top bar

export function TopBar({
    game,
    speed,
    onSpeed,
    muted,
    onMute,
    saveLabel,
    onBack,
    onMenu,
}: {
    game: Game;
    speed: number;
    onSpeed: (speed: number) => void;
    muted: boolean;
    onMute: () => void;
    saveLabel: string;
    onBack: () => void;
    onMenu: () => void;
}) {
    const epoch = game.epoch;
    const light = game.clock.light(game.state.time);
    const stats = game.stats;

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
                {game.content.resources.map((resource) => {
                    const value = game.state.resources[resource.id] ?? 0;
                    const rate = stats.rates[resource.id] ?? 0;
                    const cap = stats.caps[resource.id];
                    const full = resource.capped && value >= cap - 0.5;

                    return (
                        <div
                            key={resource.id}
                            className={`hud-res__item${full ? ' hud-res__item--full' : ''}`}
                            title={`${resource.name}${resource.capped ? ` · склад ${compact(cap)}` : ''}`}
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
                                {perMinute(rate)}
                            </span>
                        </div>
                    );
                })}

                <div
                    className="hud-res__item"
                    title={`Работают ${Math.floor(Math.min(stats.workers, stats.jobs))} из ${Math.floor(stats.workers)} · мест ${stats.jobs}`}
                >
                    <span className="hud-res__icon">👥</span>
                    <span className="hud-res__value">
                        {Math.floor(game.state.population)}
                        <small>/{stats.housing}</small>
                    </span>
                    <span className="hud-res__rate">
                        {stats.employment < 1
                            ? `рабочих ${Math.round(stats.employment * 100)}%`
                            : `${game.npcs.residents.length} на улицах`}
                    </span>
                </div>

                <div
                    className="hud-res__item"
                    title="Счастье: еда, работа, услуги рядом с домом, тепло, чистый воздух"
                >
                    <span className="hud-res__icon">
                        {face(stats.happiness)}
                    </span>
                    <span className="hud-res__value">
                        {Math.round(stats.happiness)}
                    </span>
                    <span
                        className={`hud-res__rate${stats.happiness < 40 ? ' hud-res__rate--down' : ''}`}
                    >
                        {stats.starving ? 'голод!' : 'счастье'}
                    </span>
                </div>

                {(stats.powerDemand > 0 || stats.powerSupply > 0) && (
                    <div
                        className="hud-res__item"
                        title="Энергия: выработка / потребление"
                    >
                        <span className="hud-res__icon">⚡</span>
                        <span className="hud-res__value">
                            {Math.floor(stats.powerSupply)}
                            <small>/{Math.floor(stats.powerDemand)}</small>
                        </span>
                        <span
                            className={`hud-res__rate${stats.powerSupply < stats.powerDemand ? ' hud-res__rate--down' : ''}`}
                        >
                            энергия
                        </span>
                    </div>
                )}
            </div>

            <div className="hud-top__right">
                <div className="hud-speed" role="group" aria-label="Скорость">
                    {[
                        [0, '⏸'],
                        [1, '▶'],
                        [2, '⏩'],
                        [5, '⏭'],
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

// ———————————————————————————————————————— Build menu

export function BuildMenu({
    game,
    active,
    onPick,
    onClose,
}: {
    game: Game;
    active: string | null;
    onPick: (type: string) => void;
    onClose: () => void;
}) {
    const categories = Object.keys(CATEGORY_NAMES) as Category[];
    const [category, setCategory] = useState<Category>('housing');
    const items = game.content.buildings.filter(
        (def) =>
            def.category === category &&
            !def.hidden &&
            game.content.epochOrder(def.epoch) <= game.state.epoch + 1,
    );

    return (
        <section className="build-menu" aria-label="Строительство">
            <div className="build-menu__tabs" role="tablist">
                {categories.map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={category === id}
                        onClick={() => setCategory(id)}
                    >
                        <span>{CATEGORY_NAMES[id].icon}</span>{' '}
                        {CATEGORY_NAMES[id].name}
                    </button>
                ))}
                <button
                    type="button"
                    className="build-menu__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </div>

            <div className="build-menu__list">
                {items.map((def) => {
                    const locked = game.lockReason(def);
                    const cost = game.buildCost(def);
                    const effects = def.levels[0].effects;

                    return (
                        <button
                            key={def.id}
                            type="button"
                            className={`build-card${locked ? ' build-card--locked' : ''}${active === def.id ? ' build-card--active' : ''}${!locked && !game.canAfford(cost) ? ' build-card--poor' : ''}`}
                            disabled={Boolean(locked)}
                            onClick={() => onPick(def.id)}
                            title={def.description}
                        >
                            <span className="build-card__icon">
                                {locked ? '🔒' : def.icon}
                            </span>
                            <span className="build-card__name">
                                {game.content.nameOf(def, game.state.epoch)}
                            </span>
                            <span className="build-card__desc">
                                {locked ?? def.description}
                            </span>
                            {!locked && <CostLine game={game} cost={cost} />}
                            <span className="build-card__tags">
                                <em>
                                    {def.size.w}×{def.size.h}
                                </em>
                                {effects.housing > 0 && (
                                    <em>👥 {effects.housing}</em>
                                )}
                                {effects.jobs > 0 && <em>👷 {effects.jobs}</em>}
                                {effects.aura && (
                                    <em>😊 +{effects.aura.happiness}</em>
                                )}
                                {def.levels.length > 1 && (
                                    <em>ур. 1–{def.levels.length}</em>
                                )}
                            </span>
                        </button>
                    );
                })}
                {items.length === 0 && (
                    <p className="build-menu__empty">
                        В этой эпохе здесь пока ничего нет.
                    </p>
                )}
            </div>
        </section>
    );
}

// ———————————————————————————————————————— Selected building

function effectLines(game: Game, effects: Effects): string[] {
    const lines: string[] = [];
    const res = (id: string) => game.content.resource(id);

    for (const [id, v] of Object.entries(effects.produces)) {
        lines.push(
            `${res(id)?.icon} ${res(id)?.name}: +${Math.round(v * 600) / 10}/мин`,
        );
    }

    for (const [id, v] of Object.entries(effects.consumes)) {
        lines.push(
            `${res(id)?.icon} тратит ${res(id)?.name.toLowerCase()}: ${Math.round(v * 600) / 10}/мин`,
        );
    }

    if (effects.housing) {
        lines.push(`👥 жильё на ${effects.housing}`);
    }

    if (effects.jobs) {
        lines.push(`👷 рабочих мест ${effects.jobs}`);
    }

    if (effects.storage) {
        lines.push(`📦 склад +${effects.storage}`);
    }

    if (effects.power) {
        lines.push(`⚡ энергия +${effects.power}`);
    }

    if (effects.powerUse) {
        lines.push(`🔌 потребляет энергии ${effects.powerUse}`);
    }

    if (effects.aura) {
        lines.push(
            `😊 радость +${effects.aura.happiness} в радиусе ${effects.aura.radius}`,
        );
    }

    if (effects.pollution) {
        lines.push(
            `🏭 загрязнение −${effects.pollution.amount} в радиусе ${effects.pollution.radius}`,
        );
    }

    if (effects.boost) {
        lines.push(
            `⬆ +${effects.boost.percent}% зданиям: ${effects.boost.targets.map((t) => game.content.building(t).name).join(', ')}`,
        );
    }

    if (effects.near) {
        lines.push(
            `🌲 +${effects.near.perTile}/с за каждый объект «${effects.near.feature}» рядом (до +${effects.near.max})`,
        );
    }

    if (effects.seasonal) {
        lines.push('🌦️ зависит от сезона и плодородия');
    }

    if (effects.defense) {
        lines.push(`🛡️ защита ${effects.defense}`);
    }

    return lines;
}

export function Inspector({
    game,
    building,
    onUpgrade,
    onMove,
    onDemolish,
    onClose,
}: {
    game: Game;
    building: BuildingState;
    onUpgrade: () => void;
    onMove: () => void;
    onDemolish: () => void;
    onClose: () => void;
}) {
    const def = game.def(building);
    const status = game.status.get(building.uid);
    const block = game.upgradeBlock(building);
    const next = def.levels[building.level];
    const fixed = def.hidden && def.unique;
    const problems: string[] = [];

    if (status?.complete) {
        if (!status.connected) {
            problems.push('🚧 Нет дороги до центра — здание не работает.');
        }

        if (status.noPower) {
            problems.push('⚡ Не хватает энергии.');
        }

        if (status.starved) {
            problems.push(
                `📦 Не хватает: ${game.content.resource(status.starved)?.name.toLowerCase()}.`,
            );
        }

        if (game.effects(building).jobs && game.stats.employment < 1) {
            problems.push(
                `👷 Рабочих хватает на ${Math.round(game.stats.employment * 100)}% — нужно больше жилья.`,
            );
        }
    }

    const live: ReactNode[] = [];

    for (const [id, rate] of Object.entries(status?.output ?? {})) {
        live.push(
            <li key={`o${id}`}>
                {game.content.resource(id)?.icon}{' '}
                {game.content.resource(id)?.name}: <b>{perMinute(rate)}</b>
            </li>,
        );
    }

    for (const [id, rate] of Object.entries(status?.input ?? {})) {
        live.push(
            <li key={`i${id}`}>
                {game.content.resource(id)?.icon} тратит:{' '}
                <b>{perMinute(-rate)}</b>
            </li>,
        );
    }

    if (status && game.effects(building).housing && !def.hidden) {
        live.push(
            <li key="res">
                👥 Жильцы: <b>{status.residents}</b> /{' '}
                {game.effects(building).housing}
            </li>,
        );
    }

    if (status?.happiness !== null && status?.happiness !== undefined) {
        live.push(
            <li key="hap">
                {face(status.happiness)} Уют района:{' '}
                <b>{Math.round(status.happiness)}</b>
            </li>,
        );
    }

    if (status && game.effects(building).jobs) {
        live.push(
            <li key="job">
                👷 Работают: <b>{status.workers}</b> /{' '}
                {game.effects(building).jobs}
            </li>,
        );
    }

    if (status?.nearbyFeatures) {
        live.push(
            <li key="near">
                🌲 Ресурсы рядом: <b>{status.nearbyFeatures}</b>
            </li>,
        );
    }

    if (status && status.boost > 0) {
        live.push(
            <li key="boost">
                ⬆ Бонус соседей: <b>+{Math.round(status.boost * 100)}%</b>
            </li>,
        );
    }

    const residents = game.npcs.residents.filter(
        (npc) => npc.homeUid === building.uid || npc.workUid === building.uid,
    );

    return (
        <aside className="inspector">
            <header className="inspector__head">
                <span className="inspector__icon">{def.icon}</span>
                <div>
                    <h2>{game.nameOf(building)}</h2>
                    <span className="inspector__level">
                        {'★'.repeat(building.level)}
                        {'☆'.repeat(
                            Math.max(0, def.levels.length - building.level),
                        )}{' '}
                        · уровень {building.level} из {def.levels.length}
                    </span>
                </div>
                <button
                    type="button"
                    className="inspector__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </header>

            <p className="inspector__desc">{def.description}</p>
            <p className="inspector__coords">
                📍 клетка ({building.x}, {building.y}) · {def.size.w}×
                {def.size.h} · {game.map.biomeAt(building.x, building.y).name}
            </p>

            {!game.isComplete(building) && (
                <p className="inspector__note">🏗️ Идёт строительство…</p>
            )}

            {problems.map((problem) => (
                <p key={problem} className="inspector__problem">
                    {problem}
                </p>
            ))}

            {live.length > 0 && <ul className="inspector__stats">{live}</ul>}

            {residents.length > 0 && (
                <p className="inspector__people">
                    {residents
                        .slice(0, 6)
                        .map((npc) => npc.name.split(' ')[0])
                        .join(', ')}
                    {residents.length > 6
                        ? ` и ещё ${residents.length - 6}`
                        : ''}
                </p>
            )}

            {next && !fixed && (
                <div className="inspector__next">
                    <b>Уровень {next.level}:</b>
                    <ul>
                        {effectLines(game, next.effects).map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </div>
            )}

            {!fixed && def.render !== 'road' && (
                <div className="inspector__actions">
                    {next && (
                        <button
                            type="button"
                            className="hud-button hud-button--primary"
                            disabled={
                                Boolean(block) ||
                                !game.canAfford(game.upgradeCost(building))
                            }
                            onClick={onUpgrade}
                        >
                            ⬆ Улучшить{' '}
                            {!block && (
                                <CostLine
                                    game={game}
                                    cost={game.upgradeCost(building)}
                                />
                            )}
                        </button>
                    )}
                    {block && <span className="inspector__hint">{block}</span>}
                    <div className="inspector__row">
                        <button
                            type="button"
                            className="hud-button"
                            onClick={onMove}
                        >
                            ↔ Перенести
                        </button>
                        <button
                            type="button"
                            className="hud-button hud-button--danger"
                            onClick={onDemolish}
                        >
                            🧨 Снести
                        </button>
                    </div>
                </div>
            )}

            {fixed && (
                <p className="inspector__hint">
                    Растёт сам — с каждой новой эпохой.
                </p>
            )}
        </aside>
    );
}

// ———————————————————————————————————————— A resident

const ACTIVITY: Record<NpcState['activity'], string> = {
    home: '🏠 дома',
    walking: '🚶 в пути',
    working: '🔨 на работе',
    leisure: '🌳 отдыхает',
};

export function NpcPanel({
    game,
    npc,
    following,
    onFollow,
    onClose,
}: {
    game: Game;
    npc: NpcState;
    following: boolean;
    onFollow: () => void;
    onClose: () => void;
}) {
    const type = game.npcs.typeOf(npc);
    const home = game.buildings.get(npc.homeUid);
    const work = npc.workUid ? game.buildings.get(npc.workUid) : undefined;
    const mood = game.npcs.mood(npc);

    return (
        <aside className="inspector npc-panel">
            <header className="inspector__head">
                <span className="inspector__icon">{face(mood)}</span>
                <div>
                    <h2>{npc.name}</h2>
                    <span className="inspector__level">
                        {type.name} · {npc.age} лет
                    </span>
                </div>
                <button
                    type="button"
                    className="inspector__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </header>

            <blockquote className="npc-panel__thought">
                «{game.npcs.thought(npc)}»
            </blockquote>

            <ul className="inspector__stats">
                <li>
                    Сейчас: <b>{ACTIVITY[npc.activity]}</b>
                </li>
                <li>
                    Дом:{' '}
                    <b>
                        {home
                            ? `${game.def(home).icon} ${game.nameOf(home)}`
                            : '—'}
                    </b>
                </li>
                <li>
                    Работа:{' '}
                    <b>
                        {work
                            ? `${game.def(work).icon} ${game.nameOf(work)}`
                            : 'нет работы'}
                    </b>
                </li>
                <li>
                    Настроение: <b>{mood}</b>
                </li>
                <li>
                    📍 ({npc.x.toFixed(1)}, {npc.y.toFixed(1)})
                </li>
            </ul>

            <button
                type="button"
                className={`hud-button${following ? ' hud-button--primary' : ''}`}
                onClick={onFollow}
            >
                🎥 {following ? 'Перестать следить' : 'Следить камерой'}
            </button>
        </aside>
    );
}

// ———————————————————————————————————————— Modals

export function Modal({
    title,
    onClose,
    children,
    wide,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) =>
            event.key === 'Escape' && onClose();

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div className={`modal__box${wide ? ' modal__box--wide' : ''}`}>
                <header className="modal__head">
                    <h2>{title}</h2>
                    <button
                        type="button"
                        className="inspector__close"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </header>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

export function EpochPanel({
    game,
    onAdvance,
    onClose,
}: {
    game: Game;
    onAdvance: () => void;
    onClose: () => void;
}) {
    const current = game.epoch;
    const next = game.content.epochs[game.state.epoch + 1];

    if (!next) {
        return (
            <Modal title="Эпохи" onClose={onClose}>
                <p className="epoch-panel__lead">
                    Ваш город — {current.name.toLowerCase()}. Это вершина пути:
                    растите население и улучшайте здания до максимума.
                </p>
            </Modal>
        );
    }

    const unlocks = game.content.buildings.filter(
        (def) => def.epoch === next.id && !def.hidden,
    );
    const upgrades = game.content.buildings.filter((def) =>
        def.levels.some((level) => level.requiresEpoch === next.id),
    );
    const ready = game.canAdvance();

    return (
        <Modal title="Новая эпоха" onClose={onClose}>
            <div className="epoch-panel">
                <div className="epoch-panel__path">
                    <div>
                        <span>{current.year}</span>
                        <b>{current.name}</b>
                    </div>
                    <span className="epoch-panel__arrow">→</span>
                    <div className="epoch-panel__next">
                        <span>{next.year}</span>
                        <b>{next.name}</b>
                    </div>
                </div>
                <p className="epoch-panel__lead">{next.tagline}</p>

                <ul className="checklist">
                    {game.epochChecklist().map((item) => (
                        <li
                            key={item.label}
                            className={item.done ? 'done' : ''}
                        >
                            {item.done ? '✅' : '⬜'} {item.label}
                        </li>
                    ))}
                </ul>

                <h3>Что откроется</h3>
                <div className="epoch-panel__unlocks">
                    {unlocks.map((def) => (
                        <span key={def.id} title={def.description}>
                            {def.icon}{' '}
                            {game.content.nameOf(def, game.state.epoch + 1)}
                        </span>
                    ))}
                    {upgrades.length > 0 && (
                        <span>
                            ⬆ новые уровни:{' '}
                            {upgrades.map((def) => def.icon).join(' ')}
                        </span>
                    )}
                    <span>
                        🗺️ земли {next.territory * 2}×{next.territory * 2}
                    </span>
                    <span>🎨 новая архитектура</span>
                </div>

                <button
                    type="button"
                    className="hud-button hud-button--primary hud-button--big"
                    disabled={!ready}
                    onClick={onAdvance}
                >
                    {ready
                        ? `🚀 Перейти в ${next.year} год`
                        : 'Выполните условия'}
                </button>
            </div>
        </Modal>
    );
}

export function Stats({ game, onClose }: { game: Game; onClose: () => void }) {
    const counts = new Map<string, number>();

    for (const building of game.buildings.values()) {
        counts.set(building.type, (counts.get(building.type) ?? 0) + 1);
    }

    const working = game.npcs.residents.filter((npc) => npc.workUid).length;

    return (
        <Modal title="Статистика города" onClose={onClose} wide>
            <div className="stats">
                <div className="stats__tiles">
                    <div>
                        <b>{compact(game.score())}</b>
                        <span>очков развития</span>
                    </div>
                    <div>
                        <b>{Math.floor(game.state.population)}</b>
                        <span>жителей</span>
                    </div>
                    <div>
                        <b>
                            {face(game.stats.happiness)}{' '}
                            {Math.round(game.stats.happiness)}
                        </b>
                        <span>счастье</span>
                    </div>
                    <div>
                        <b>
                            {working} / {game.npcs.residents.length}
                        </b>
                        <span>жителей-NPC с работой</span>
                    </div>
                    <div>
                        <b>{game.clock.day(game.state.time) + 1}</b>
                        <span>игровых дней</span>
                    </div>
                    <div>
                        <b>
                            {game.map.width}×{game.map.height}
                        </b>
                        <span>клеток карты</span>
                    </div>
                </div>

                <div className="stats__table">
                    <h3>Экономика, в минуту</h3>
                    <ul>
                        {game.content.resources.map((resource) => (
                            <li key={resource.id}>
                                {resource.icon} {resource.name}{' '}
                                <b
                                    className={
                                        (game.stats.rates[resource.id] ?? 0) < 0
                                            ? 'neg'
                                            : ''
                                    }
                                >
                                    {perMinute(
                                        game.stats.rates[resource.id] ?? 0,
                                    )}
                                </b>
                            </li>
                        ))}
                    </ul>
                    <h3>Постройки</h3>
                    <ul>
                        {[...counts.entries()].map(([type, count]) => (
                            <li key={type}>
                                {game.content.building(type).icon}{' '}
                                {game.content.nameOf(
                                    game.content.building(type),
                                    game.state.epoch,
                                )}{' '}
                                <b>{count}</b>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Modal>
    );
}

export function EpochSplash({
    game,
    epoch,
    onDone,
}: {
    game: Game;
    epoch: number;
    onDone: () => void;
}) {
    const info = game.content.epoch(epoch);
    const from = game.content.epoch(Math.max(0, epoch - 1)).year;
    const [year, setYear] = useState(from);

    useEffect(() => {
        const start = performance.now();
        let frame = 0;
        const step = (now: number) => {
            const progress = Math.min(1, (now - start) / 1600);

            setYear(
                Math.round(
                    from + (info.year - from) * (1 - Math.pow(1 - progress, 3)),
                ),
            );

            if (progress < 1) {
                frame = requestAnimationFrame(step);
            }
        };

        frame = requestAnimationFrame(step);

        const timer = window.setTimeout(onDone, 5200);

        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [from, info.year, onDone]);

    return (
        <div className="epoch-splash" onClick={onDone} role="status">
            <div className="epoch-splash__year">{year}</div>
            <div className="epoch-splash__name">{info.name}</div>
            <p className="epoch-splash__tagline">{info.tagline}</p>
            <span className="epoch-splash__skip">
                нажмите, чтобы продолжить
            </span>
        </div>
    );
}
