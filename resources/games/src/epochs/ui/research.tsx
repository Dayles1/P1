import { useState } from 'react';
import type { TechBonus, TechDef } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { Bar, CostLine, Modal, duration } from './common';

function bonusLines(game: Game, bonus: TechBonus | null): string[] {
    if (!bonus) {
        return [];
    }

    const lines: string[] = [];

    for (const [id, percent] of Object.entries(bonus.produces ?? {})) {
        lines.push(
            `${id === '*' ? '🏭 всё производство' : `${game.content.resource(id)?.icon ?? ''} ${game.content.resource(id)?.name ?? id}`} +${percent}%`,
        );
    }

    if (bonus.happiness) {
        lines.push(`😊 счастье +${bonus.happiness}`);
    }

    if (bonus.housing) {
        lines.push(`👥 жильё +${bonus.housing}%`);
    }

    if (bonus.storage) {
        lines.push(`📦 склады +${bonus.storage}%`);
    }

    if (bonus.buildSpeed) {
        lines.push(`🏗️ стройка быстрее на ${bonus.buildSpeed}%`);
    }

    if (bonus.tax) {
        lines.push(`💰 налоги +${bonus.tax}%`);
    }

    if (bonus.research) {
        lines.push(`🔬 исследования быстрее на ${bonus.research}%`);
    }

    return lines;
}

function TechCard({
    game,
    tech,
    keyTech,
    onResearch,
}: {
    game: Game;
    tech: TechDef;
    keyTech: boolean;
    onResearch: (id: string) => void;
}) {
    const done = game.hasTech(tech.id);
    const research = game.state.research;
    const active = research?.id === tech.id;
    const lock = game.techLock(tech);
    const unlocks = game.techUnlocks(tech);
    const state = done ? 'done' : active ? 'active' : lock ? 'locked' : 'open';

    return (
        <article
            className={`tech-card tech-card--${state}${keyTech ? ' tech-card--key' : ''}`}
        >
            <header>
                <span className="tech-card__icon">{tech.icon}</span>
                <div>
                    <b>{tech.name}</b>
                    {keyTech && (
                        <small className="tech-card__key">
                            ключ к новой эпохе
                        </small>
                    )}
                </div>
            </header>
            <p>{tech.description}</p>
            {tech.requires.length > 0 && (
                <p className="tech-card__requires">
                    ⤷{' '}
                    {tech.requires
                        .map((id) => {
                            const required = game.content.tech(id);

                            return `${game.hasTech(id) ? '✓' : '○'} ${required?.name ?? id}`;
                        })
                        .join(' · ')}
                </p>
            )}
            {(unlocks.length > 0 || tech.bonus) && (
                <ul className="tech-card__gives">
                    {unlocks.map(({ def, level }) => (
                        <li key={`${def.id}${level.level}`}>
                            {def.icon} {level.name}
                        </li>
                    ))}
                    {bonusLines(game, tech.bonus).map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            )}
            <footer>
                {done && <span className="tech-card__done">✓ Изучено</span>}
                {active && research && (
                    <span className="tech-card__progress">
                        <Bar
                            value={
                                (game.state.time - research.start) /
                                Math.max(1, research.end - research.start)
                            }
                            tone="accent"
                        />
                        <small>
                            ещё {duration(research.end - game.state.time)}
                        </small>
                    </span>
                )}
                {!done && !active && (
                    <>
                        <CostLine game={game} cost={tech.cost} />
                        <small>⏱ {duration(game.researchTime(tech))}</small>
                        <button
                            type="button"
                            className="hud-button hud-button--primary"
                            disabled={
                                Boolean(lock) || !game.canAfford(tech.cost)
                            }
                            title={lock ?? ''}
                            onClick={() => onResearch(tech.id)}
                        >
                            🔬 Изучить
                        </button>
                    </>
                )}
            </footer>
        </article>
    );
}

/** The technology tree: one column per era, from the first to the next one. */
export function TechTree({
    game,
    onClose,
}: {
    game: Game;
    onClose: () => void;
}) {
    const last = Math.min(game.content.epochs.length - 1, game.state.epoch + 1);
    const [era, setEra] = useState(game.state.epoch);
    const epoch = game.content.epoch(era);
    const techs = game.content.techs.filter((tech) => tech.epoch === epoch.id);
    const keys = new Set(epoch.next?.techs ?? []);
    const doneInEra = techs.filter((tech) => game.hasTech(tech.id)).length;

    return (
        <Modal title="Технологии" onClose={onClose} wide className="tech-modal">
            <nav className="era-tabs">
                {game.content.epochs.slice(0, last + 1).map((item, index) => {
                    const list = game.content.techs.filter(
                        (tech) => tech.epoch === item.id,
                    );
                    const done = list.filter((tech) => game.hasTech(tech.id));

                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={era === index}
                            onClick={() => setEra(index)}
                        >
                            <b>{item.year}</b>
                            <span>{item.name}</span>
                            <small>
                                {done.length}/{list.length}
                            </small>
                        </button>
                    );
                })}
            </nav>
            <p className="tech-modal__lead">
                {epoch.name}: изучено {doneInEra} из {techs.length}. Знания 📜
                дают школы, университеты и лаборатории. Одновременно идёт одно
                исследование.
                {era > game.state.epoch &&
                    ' Эти технологии откроются в следующей эпохе.'}
            </p>
            <div className="tech-grid">
                {techs.map((tech) => (
                    <TechCard
                        key={tech.id}
                        game={game}
                        tech={tech}
                        keyTech={keys.has(tech.id)}
                        onResearch={(id) => game.research(id)}
                    />
                ))}
            </div>
        </Modal>
    );
}
