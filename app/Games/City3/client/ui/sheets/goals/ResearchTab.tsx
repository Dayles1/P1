/**
 * Discoveries as a timeline (ui-spec §5.2 Research, §6.8, gdd §9.1): one
 * column per era, its four cards; on phones the columns snap-scroll with
 * the current era centred. A card: name, one effect, what it opens, cost
 * and time, «Изучить» — or done, under way (accent bar, time left),
 * locked to another era or behind another discovery.
 */

import { useEffect, useRef } from 'react';
import type { TechBonus, TechDef } from '../../../engine/content/types';
import type { Game } from '../../../engine/sim/game';
import { useGame, useSecond } from '../../context';
import { years } from '../../format';
import { t } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Bar, CostLine } from '../../kit/kit';

function bonusLine(game: Game, bonus: TechBonus | null): string | null {
    if (!bonus) {
        return null;
    }

    for (const [id, percent] of Object.entries(bonus.produces ?? {})) {
        return id === '*'
            ? t('bonus.all', { n: percent })
            : t('bonus.produces', {
                  res: game.content.resource(id)?.name ?? id,
                  n: percent,
              });
    }

    if (bonus.happiness) {
        return t('bonus.happiness', { n: bonus.happiness });
    }

    if (bonus.housing) {
        return t('bonus.housing', { n: bonus.housing });
    }

    if (bonus.tax) {
        return t('bonus.tax', { n: bonus.tax });
    }

    if (bonus.trade) {
        return t('bonus.trade', { n: bonus.trade });
    }

    if (bonus.research) {
        return t('bonus.research', { n: bonus.research });
    }

    if (bonus.traffic) {
        return t('bonus.traffic', { n: bonus.traffic });
    }

    return null;
}

/** Game seconds as whole years (at least one). */
function inYears(game: Game, seconds: number): string {
    return years(Math.max(1, Math.round(seconds / game.clock.secondsPerYear)));
}

function TechCard({ tech, keyTech }: { tech: TechDef; keyTech: boolean }) {
    const game = useGame();
    const done = game.hasTech(tech.id);
    const research = game.state.research;
    const active = research?.id === tech.id;
    const era = game.content.epochOrder(tech.epoch);
    const missing = tech.requires.filter((id) => !game.hasTech(id));
    const unlocks = game.techUnlocks(tech);
    const cost = game.techCost(tech);
    let lock: string | null = null;

    if (!done && !active) {
        if (era > game.state.epoch) {
            lock = t('research.lockEra', { era: game.content.epoch(era).name });
        } else if (missing.length) {
            lock = t('research.needs', {
                list: missing
                    .map((id) => game.content.tech(id)?.name ?? id)
                    .join(', '),
            });
        } else if (research) {
            lock = t('research.after', {
                name: game.content.tech(research.id)?.name ?? research.id,
            });
        }
    }

    const state = done ? 'done' : active ? 'active' : lock ? 'locked' : 'open';
    const effect = bonusLine(game, tech.bonus) ?? tech.description;

    return (
        <article className={`c3-tech c3-tech--${state}`}>
            <header className="c3-tech__head">
                <Icon
                    name={done ? 'check' : 'flask'}
                    className={done ? 'c3-pos' : active ? 'c3-era' : 'c3-mut'}
                />
                <b>{tech.name}</b>
            </header>
            {keyTech && !done && (
                <span className="c3-tech__key">{t('research.key')}</span>
            )}
            <p className="c3-tech__fx">{effect}</p>
            {unlocks.length > 0 && (
                <p className="c3-tech__opens">
                    {t('research.opens', {
                        list: unlocks.map(({ level }) => level.name).join(', '),
                    })}
                </p>
            )}
            {done && (
                <span className="c3-tech__state c3-pos">
                    {t('research.done')}
                </span>
            )}
            {active && research && (
                <span className="c3-tech__state">
                    <Bar
                        value={
                            (game.state.time - research.start) /
                            Math.max(1, research.end - research.start)
                        }
                    />
                    {t('research.left', {
                        t: inYears(game, research.end - game.state.time),
                    })}
                </span>
            )}
            {state === 'locked' && <span className="c3-lockline">{lock}</span>}
            {state === 'open' && (
                <div className="c3-tech__buy">
                    <span className="c3-tech__cost">
                        <CostLine cost={cost} />
                        <small className="c3-mut">
                            {inYears(game, game.researchTime(tech))}
                        </small>
                    </span>
                    <button
                        type="button"
                        className="c3-btn c3-btn--primary c3-btn--small"
                        disabled={!game.canAfford(cost)}
                        onClick={() => game.research(tech.id)}
                    >
                        {t('research.start')}
                    </button>
                </div>
            )}
        </article>
    );
}

export function ResearchTab() {
    const game = useGame();
    const scroller = useRef<HTMLDivElement>(null);

    useSecond();

    useEffect(() => {
        scroller.current
            ?.querySelector('.is-current')
            ?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, []);

    return (
        <div className="c3-timeline" ref={scroller}>
            {game.content.epochs.map((epoch, index) => {
                const techs = game.content.techs.filter(
                    (tech) => tech.epoch === epoch.id,
                );
                const next = game.content.epochs[index + 1];
                const keys = new Set(
                    (next?.entry?.items ?? []).flatMap((item) =>
                        game.content.hasBuilding(item.type)
                            ? (game.content.building(item.type).levels[
                                  item.level - 1
                              ]?.tech ?? [])
                            : [],
                    ),
                );
                const done = techs.filter((tech) =>
                    game.hasTech(tech.id),
                ).length;

                if (!techs.length) {
                    return null;
                }

                return (
                    <section
                        key={epoch.id}
                        className={`c3-era-col${index === game.state.epoch ? ' is-current' : ''}`}
                        style={{ ['--tag' as string]: epoch.accent }}
                    >
                        <h3>
                            <i className="c3-era-dot" />
                            {t('research.lead', {
                                era: epoch.name,
                                done,
                                total: techs.length,
                            })}
                        </h3>
                        {techs.map((tech) => (
                            <TechCard
                                key={tech.id}
                                tech={tech}
                                keyTech={keys.has(tech.id)}
                            />
                        ))}
                    </section>
                );
            })}
        </div>
    );
}
