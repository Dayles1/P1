import { useEffect, useState } from 'react';
import type { Category } from '../engine/content/types';
import type { Budget, Game } from '../engine/sim/game';
import {
    Bar,
    CATEGORY_NAMES,
    CostLine,
    face,
    formatExact,
    formatNumber,
    formatRate,
    Modal,
    MoneyIcon,
} from './common';

const INCOME_NAMES: Record<keyof Budget['income'], string> = {
    tax: '🏠 Налоги',
    trade: '⚖️ Экспорт',
    tourism: '🎟️ Туризм',
    fares: '🚇 Проезд в метро',
};

const IMPORT_NAMES: Record<Exclude<keyof Budget['costs'], 'upkeep'>, string> = {
    food: '🌾 Покупка еды',
    fuel: '🛢️ Покупка топлива',
    power: '🔌 Электричество из сети',
};

function upkeepName(key: string): string {
    if (key === 'roads') {
        return '🛣️ Содержание улиц';
    }

    const category = CATEGORY_NAMES[key as Category];

    return category
        ? `${category.icon} Содержание: ${category.name.toLowerCase()}`
        : key;
}

function BudgetRow({
    label,
    amount,
    scale,
    tone,
}: {
    label: string;
    amount: number;
    scale: number;
    tone: 'good' | 'bad';
}) {
    return (
        <li className="budget__row">
            <span>{label}</span>
            <Bar value={amount / scale} tone={tone} />
            <b>{formatRate(tone === 'bad' ? -amount : amount)}</b>
        </li>
    );
}

/**
 * Money per year (gdd §11.2 City sheet v1): income by source, expenses by
 * kind — upkeep by category with the imports apart — and the net.
 */
export function BudgetBars({ game }: { game: Game }) {
    const budget = game.stats.budget;
    const scale = Math.max(1, budget.gross, budget.spent);
    const income = (
        Object.entries(budget.income) as [keyof Budget['income'], number][]
    ).filter(([id, amount]) => id === 'tax' || amount > 0.005);
    const costs: [string, number][] = [
        ...Object.entries(budget.upkeepBy)
            .filter(([, amount]) => amount > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([key, amount]): [string, number] => [
                upkeepName(key),
                amount,
            ]),
        ...(
            Object.entries(IMPORT_NAMES) as [
                keyof typeof IMPORT_NAMES,
                string,
            ][]
        )
            .filter(([id]) => budget.costs[id] > 0.005)
            .map(([id, label]): [string, number] => [label, budget.costs[id]]),
    ];

    return (
        <div className="budget">
            <ul className="budget__col">
                <li className="budget__head">
                    Доходы <b>{formatRate(budget.gross)}</b>
                </li>
                {income.map(([id, amount]) => (
                    <BudgetRow
                        key={id}
                        label={INCOME_NAMES[id]}
                        amount={amount}
                        scale={scale}
                        tone="good"
                    />
                ))}
            </ul>
            <ul className="budget__col">
                <li className="budget__head">
                    Расходы{' '}
                    <b>
                        {budget.spent > 0 ? formatRate(-budget.spent) : '0/год'}
                    </b>
                </li>
                {costs.length ? (
                    costs.map(([label, amount]) => (
                        <BudgetRow
                            key={label}
                            label={label}
                            amount={amount}
                            scale={scale}
                            tone="bad"
                        />
                    ))
                ) : (
                    <li className="budget__row">
                        <span>Пока нет</span>
                    </li>
                )}
            </ul>
            <p className={`budget__net${budget.net < 0 ? ' neg' : ''}`}>
                Итого за год: <b>{formatRate(budget.net)}</b>
                {game.stats.arrears && ' · казна пуста, недоимка'}
            </p>
        </div>
    );
}

/** «Рабочие руки» (gdd §4.1): short of workers, balanced, or unemployment. */
function labourLine(game: Game): { text: string; bad: boolean } {
    const stats = game.stats;
    const short = Object.values(stats.staff).some((share) => share < 0.95);

    if (short) {
        return {
            text: `не хватает рабочих (заняты ${Math.round(stats.employment * 100)}% мест) — стройте дома`,
            bad: true,
        };
    }

    if (stats.unemployment > 0.05) {
        const loss =
            game.content.world.economy.unemploymentTaxLoss * stats.unemployment;
        const lost = loss < 1 ? (stats.tax * loss) / (1 - loss) : 0;

        return {
            text: `безработица ${Math.round(stats.unemployment * 100)}% — стройте рабочие места (налоги теряют ${formatNumber(lost)}/год)`,
            bad: true,
        };
    }

    return { text: 'баланс', bad: false };
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
                    Ваш город дошёл до эпохи «{current.name}» — вершины пути.
                    Растите население, изучайте оставшиеся технологии, собирайте
                    достижения и стройте исторические кварталы.
                </p>
            </Modal>
        );
    }

    const unlocks = game.content.buildings.filter(
        (def) => !def.hidden && def.levels[0].epoch === next.id,
    );
    const upgrades = game.content.buildings.filter(
        (def) =>
            def.levels[0].epoch !== next.id &&
            def.levels.some((level) => level.epoch === next.id),
    );
    const resources = game.content.resources.filter(
        (resource) => resource.epoch === next.id,
    );
    const ready = game.canAdvance();
    const coin = next.currency;

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
                            {item.target !== undefined &&
                                `: ${formatNumber(item.current ?? 0)} / ${formatNumber(item.target)}`}
                            {item.cost && (
                                <>
                                    {' '}
                                    <CostLine game={game} cost={item.cost} />
                                </>
                            )}
                        </li>
                    ))}
                </ul>
                <p className="epoch-panel__note">
                    <MoneyIcon face={coin} /> Деньги станут «{coin.name}» — та
                    же казна, новая монета.
                </p>

                <h3>Что откроется</h3>
                <div className="epoch-panel__unlocks">
                    {resources.map((resource) => (
                        <span key={resource.id} title={resource.description}>
                            {resource.icon} {resource.name}
                        </span>
                    ))}
                    {unlocks.map((def) => (
                        <span key={def.id} title={def.description}>
                            {def.icon} {def.levels[0].name}
                        </span>
                    ))}
                    {upgrades.length > 0 && (
                        <span
                            title={upgrades.map((def) => def.name).join(', ')}
                        >
                            ⬆ новые уровни:{' '}
                            {upgrades.map((def) => def.icon).join(' ')}
                        </span>
                    )}
                    <span>
                        🔬{' '}
                        {
                            game.content.techs.filter(
                                (tech) => tech.epoch === next.id,
                            ).length
                        }{' '}
                        технологий
                    </span>
                </div>
                <p className="epoch-panel__note">
                    Уже построенные здания не изменятся сами — улучшайте их,
                    когда захотите, или оставьте старый квартал как есть.
                </p>

                <button
                    type="button"
                    className="hud-button hud-button--primary hud-button--big"
                    disabled={!ready}
                    onClick={onAdvance}
                >
                    {ready
                        ? `🚀 Начать эпоху «${next.name}»`
                        : 'Выполните условия'}
                </button>
            </div>
        </Modal>
    );
}

export function Goals({ game, onClose }: { game: Game; onClose: () => void }) {
    const goals = game.content.goals;
    const done = game.state.achievements.length;

    return (
        <Modal title="Цели и достижения" onClose={onClose} wide>
            <p className="tech-modal__lead">
                Выполнено {done} из {goals.length}. За каждую цель — награда.
            </p>
            <div className="goal-grid">
                {goals.map((goal) => {
                    const achieved = game.state.achievements.includes(goal.id);
                    const future =
                        game.content.epochOrder(goal.epoch) > game.state.epoch;
                    const progress = game.goalProgress(goal);
                    const money = goal.reward[game.content.currency] ?? 0;
                    const reward = money
                        ? `${game.content.currencyFace(game.state.epoch).symbol} ${formatNumber(money)}`
                        : '';

                    return (
                        <article
                            key={goal.id}
                            className={`goal${achieved ? ' goal--done' : ''}${future ? ' goal--future' : ''}`}
                        >
                            <span className="goal__icon">
                                {future ? '🔒' : goal.icon}
                            </span>
                            <div>
                                <b>{goal.name}</b>
                                <p>
                                    {future
                                        ? `Эпоха «${game.content.epochById(goal.epoch).name}»`
                                        : goal.description}
                                </p>
                                {!achieved && !future && (
                                    <span className="goal__progress">
                                        <Bar
                                            value={
                                                progress.current /
                                                progress.target
                                            }
                                            tone="good"
                                        />
                                        <small>
                                            {formatNumber(progress.current)} /{' '}
                                            {formatNumber(progress.target)}
                                        </small>
                                    </span>
                                )}
                                {reward && (
                                    <small className="goal__reward">
                                        {achieved ? '✓ ' : '🎁 '}
                                        {reward}
                                    </small>
                                )}
                            </div>
                        </article>
                    );
                })}
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
    const coin = game.content.currencyFace(game.state.epoch);
    const money = game.content.currency;
    const labour = labourLine(game);
    const waste = game.stats.flows?.waste ?? {};

    return (
        <Modal title="Статистика города" onClose={onClose} wide>
            <div className="stats">
                <div className="stats__tiles">
                    <div>
                        <b>{formatNumber(game.score())}</b>
                        <span>очков развития</span>
                    </div>
                    <div>
                        <b>{formatNumber(Math.floor(game.state.population))}</b>
                        <span>жителей</span>
                    </div>
                    <div title={formatExact(game.money)}>
                        <b>
                            <MoneyIcon face={coin} /> {formatNumber(game.money)}
                        </b>
                        <span>
                            {coin.short.toLowerCase()} ·{' '}
                            {formatRate(game.stats.rates[money] ?? 0)}
                        </span>
                    </div>
                    <div>
                        <b>{formatNumber(game.stats.tax)}</b>
                        <span>налогов в год</span>
                    </div>
                    <div>
                        <b>
                            {face(game.stats.happiness)}{' '}
                            {Math.round(game.stats.happiness)}
                        </b>
                        <span>счастье</span>
                    </div>
                    <div>
                        <b>{game.state.techs.length}</b>
                        <span>технологий</span>
                    </div>
                    <div>
                        <b>{game.state.achievements.length}</b>
                        <span>достижений</span>
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
                    {game.stats.tourism > 0 && (
                        <div>
                            <b>{formatRate(game.stats.tourism)}</b>
                            <span>от туристов</span>
                        </div>
                    )}
                    {(game.stats.powerDemand > 0 ||
                        game.stats.powerSupply > 0) && (
                        <div>
                            <b>
                                ⚡ {formatNumber(game.stats.powerSupply)} /{' '}
                                {formatNumber(game.stats.powerDemand)}
                            </b>
                            <span>электричество: есть / нужно</span>
                        </div>
                    )}
                </div>

                <h3 className="stats__heading">Бюджет, в год</h3>
                <BudgetBars game={game} />
                <p
                    className={`stats__labour${labour.bad ? ' neg' : ''}`}
                    title="Работают половина жителей; места заполняются по очереди: услуги, еда, добыча, производство, торговля"
                >
                    👷 Рабочие руки: <b>{labour.text}</b>
                </p>

                <div className="stats__table">
                    <h3>Склады, в год</h3>
                    <ul>
                        {game
                            .visibleResources()
                            .filter((resource) => resource.kind !== 'currency')
                            .map((resource) => (
                                <li
                                    key={resource.id}
                                    title={resource.description}
                                >
                                    {resource.icon}{' '}
                                    {resource.faces?.[game.epoch.id] ??
                                        resource.name}{' '}
                                    {formatNumber(
                                        game.state.resources[resource.id] ?? 0,
                                    )}
                                    <small>
                                        /
                                        {formatNumber(
                                            game.stats.caps[resource.id],
                                        )}
                                    </small>{' '}
                                    <b
                                        className={
                                            (game.stats.rates[resource.id] ??
                                                0) < 0
                                                ? 'neg'
                                                : ''
                                        }
                                    >
                                        {formatRate(
                                            game.stats.rates[resource.id] ?? 0,
                                        )}
                                    </b>
                                    {(waste[resource.id] ?? 0) > 0.05 && (
                                        <small className="neg">
                                            пропадает{' '}
                                            {formatRate(waste[resource.id])}
                                        </small>
                                    )}
                                </li>
                            ))}
                    </ul>
                    <h3>Постройки</h3>
                    <ul>
                        {[...counts.entries()].map(([type, count]) => (
                            <li key={type}>
                                {game.content.building(type).icon}{' '}
                                {game.content.building(type).name}{' '}
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
    // The calendar does not jump with the era: the splash shows today's year.
    const [year] = useState(game.year);

    useEffect(() => {
        const timer = window.setTimeout(onDone, 5200);

        return () => window.clearTimeout(timer);
    }, [onDone]);

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
