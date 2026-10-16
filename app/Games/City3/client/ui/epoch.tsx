import { useEffect, useState } from 'react';
import type { Game } from '../engine/sim/game';
import { Bar, compact, face, Modal, perMinute } from './common';

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
                        🗺️ земли {next.territory * 2}×{next.territory * 2}
                    </span>
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
                        ? `🚀 Перейти в ${next.year} год`
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
                    const reward = Object.entries(goal.reward)
                        .map(
                            ([id, amount]) =>
                                `${game.content.resource(id)?.icon ?? id} ${compact(amount)}`,
                        )
                        .join(' ');

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
                                            {compact(progress.current)} /{' '}
                                            {compact(progress.target)}
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

    return (
        <Modal title="Статистика города" onClose={onClose} wide>
            <div className="stats">
                <div className="stats__tiles">
                    <div>
                        <b>{compact(game.score())}</b>
                        <span>очков развития</span>
                    </div>
                    <div>
                        <b>{compact(game.state.population)}</b>
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
                            <b>{perMinute(game.stats.tourism)}</b>
                            <span>💰 от туристов</span>
                        </div>
                    )}
                </div>

                <div className="stats__table">
                    <h3>Экономика, в минуту</h3>
                    <ul>
                        {game.visibleResources().map((resource) => (
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
