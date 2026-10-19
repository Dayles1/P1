/**
 * The Town Hall card (ui-spec §5.2 TownHallSheet, §6.7, gdd §2.2, §4.10,
 * §4.11): the gate checklist (each line leads to its fix), the stars row
 * (the best still reachable outlined), the upgrade button with price and
 * build years (or the build's progress), the Spirit of the Age, the
 * policies (taxes, dense housing) with their 5-year lock, the loan offer
 * when the upgrade is unaffordable, the debt and the storage cap.
 */

import type { GateLine } from '../../engine/sim/game';
import { useCtl, useGame, useSecond } from '../context';
import { formatExact, formatNumber, formatRate, years } from '../format';
import { t, word } from '../i18n';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';
import { Bar, CostLine, Row, Segmented } from '../kit/kit';
import { Thumb } from './build/Thumb';
import { Section, Sheet } from './Sheet';

const LINE_ICONS: Record<GateLine['kind'], IconName> = {
    population: 'people',
    item: 'factory',
    discoveries: 'flask',
};

export function LoanOffer({ offer }: { offer: number }) {
    const ctl = useCtl();
    const game = useGame();
    const loan = game.content.world.economy.treasury.loan;

    if (offer <= 0) {
        return null;
    }

    return (
        <div className="c3-loan">
            <span>
                {t('loan.offer', {
                    max: formatExact(offer),
                    rate: Math.round(loan.ratePerYear * 100),
                })}
                <span className="c3-li__sub">
                    {t('loan.repay', {
                        share: Math.round(loan.repayShareOfNet * 100),
                    })}
                </span>
            </span>
            <button
                type="button"
                className="c3-btn c3-btn--small"
                onClick={() => ctl.takeLoan(offer)}
            >
                {t('loan.take')}
            </button>
        </div>
    );
}

export function TownHallSheet() {
    const ctl = useCtl();
    const game = useGame();

    useSecond();

    const center = game.center;
    const next = game.nextEpoch;
    const upgrade = game.townHallUpgrade();
    const lines = game.gateLines();
    const block = game.gateBlock();
    const building = game.townHallBuilding();
    const affordable = upgrade ? game.canAfford(upgrade.cost) : false;
    const economy = game.state.economy;
    const rules = game.content.world.economy.policies;
    const taxLock = game.policyLock('tax');
    const denseLock = game.policyLock('dense');
    const spy = game.clock.secondsPerYear;
    const stars = next?.entry?.stars;
    const year = game.year;
    const def = center ? game.def(center) : null;
    const done = lines.filter((line) => line.done).length;
    const left = lines.length - done;

    const fix = (line: GateLine) => {
        if (line.kind === 'item' && line.type) {
            const item = game.content.building(line.type);
            const level = game.availableLevels(item).at(-1);

            if (level) {
                ctl.startPlace(line.type, level, false);

                return;
            }
        }

        if (line.kind === 'discoveries') {
            ctl.openGoals('research');
        } else if (line.kind === 'population') {
            ctl.openBuild('housing');
        }
    };

    return (
        <Sheet
            title={center ? game.levelDef(center).name : t('hall.title')}
            sub={
                center && def
                    ? next && upgrade
                        ? t('hall.sub', {
                              l: center.level,
                              max: def.levels.length,
                              next: upgrade.level.name,
                              era: next.name,
                          })
                        : t('hall.subLast', {
                              l: center.level,
                              max: def.levels.length,
                          })
                    : undefined
            }
            thumb={
                center && def ? (
                    <Thumb
                        key={center.level}
                        def={def}
                        level={center.level}
                        size={64}
                        fallback="hall"
                        className="c3-ph-thumb"
                    />
                ) : undefined
            }
        >
            {!next || !upgrade ? (
                <p className="c3-hint">{t('hall.last')}</p>
            ) : (
                <>
                    <Section
                        title={t('hall.gate', {
                            era: next.name,
                            d: done,
                            n: lines.length,
                        })}
                    >
                        <ul className="c3-lst">
                            {lines.map((line) => (
                                <li key={line.label}>
                                    <button
                                        type="button"
                                        className={`c3-li c3-li--button${line.done ? ' c3-li--done' : ''}`}
                                        disabled={line.done}
                                        onClick={() => fix(line)}
                                    >
                                        <Icon
                                            name={
                                                line.done
                                                    ? 'check'
                                                    : LINE_ICONS[line.kind]
                                            }
                                            className={
                                                line.done ? '' : 'c3-mut'
                                            }
                                        />
                                        <span>
                                            {line.label}
                                            {!line.done && (
                                                <Bar
                                                    value={
                                                        line.current /
                                                        Math.max(1, line.target)
                                                    }
                                                />
                                            )}
                                        </span>
                                        <span
                                            className={`c3-num${line.done ? ' c3-mut' : ''}`}
                                        >
                                            {line.done && line.target <= 1
                                                ? t('common.ready')
                                                : `${formatNumber(line.current)} / ${formatNumber(line.target)}`}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Section>
                    {stars && (
                        <Section title={t('hall.stars', { era: next.name })}>
                            <div className="c3-stars">
                                {(
                                    [
                                        [3, stars[1]],
                                        [2, stars[0]],
                                        [1, next.year],
                                    ] as const
                                ).map(([count, by], index, all) => {
                                    const reachable = year <= by;
                                    const best =
                                        reachable &&
                                        all.findIndex(([, y]) => year <= y) ===
                                            index;

                                    return (
                                        <div
                                            key={count}
                                            className={`c3-star${best ? ' c3-star--reach' : ''}${reachable ? '' : ' c3-star--gone'}`}
                                        >
                                            <b>{'★'.repeat(count)}</b>
                                            {t('hall.starBy', {
                                                year: formatExact(by),
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                    {upgrade.spirit > 0 && (
                        <p className="c3-hint">
                            {t('hall.spirit', {
                                pct: Math.round(upgrade.spirit * 100),
                            })}
                        </p>
                    )}
                    {building && center ? (
                        <div className="c3-banner c3-banner--info">
                            <span>
                                {t('hall.building', {
                                    level: upgrade.level.name,
                                })}
                            </span>
                            <Bar
                                value={
                                    (game.state.time - center.buildStart) /
                                    Math.max(
                                        1,
                                        center.buildEnd - center.buildStart,
                                    )
                                }
                            />
                            <span className="c3-mut">
                                {t('hall.eraStarts', {
                                    era: next.name,
                                    year: game.clock.year(center.buildEnd),
                                })}
                            </span>
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                className={`c3-btn c3-btn--primary c3-btn--wide${!block && affordable ? ' is-glint' : ''}`}
                                disabled={Boolean(block) || !affordable}
                                onClick={() => {
                                    if (game.advanceEpoch().ok) {
                                        ctl.close();
                                    }
                                }}
                            >
                                {t('hall.upgrade', {
                                    level: upgrade.level.name,
                                })}
                                <CostLine cost={upgrade.cost} />
                            </button>
                            <p className="c3-why">
                                {block
                                    ? t('hall.more', {
                                          n: left,
                                          word: word(left, 'conditions'),
                                          years: years(upgrade.buildTime / spy),
                                      })
                                    : t('hall.buildYears', {
                                          years: years(upgrade.buildTime / spy),
                                      })}
                            </p>
                            {center && (
                                <button
                                    type="button"
                                    className="c3-link c3-link--center"
                                    onClick={() =>
                                        ctl.open('price', {
                                            price: {
                                                uid: center.uid,
                                                level: upgrade.level.level,
                                            },
                                        })
                                    }
                                >
                                    {t('inspector.price')}
                                </button>
                            )}
                            {!block && !affordable && (
                                <LoanOffer offer={game.loanOffer()} />
                            )}
                        </>
                    )}
                </>
            )}
            <div className="c3-rule" />
            <Section title={t('hall.taxes')}>
                <Segmented
                    label={t('hall.taxes')}
                    value={economy.policy}
                    onChange={(value) => game.setTaxPolicy(value)}
                    options={(['low', 'normal', 'high'] as const).map((id) => ({
                        value: id,
                        label: rules.tax.options[id].name,
                        hint:
                            id === 'low'
                                ? t('hall.tax.low')
                                : id === 'high'
                                  ? t('hall.tax.high')
                                  : '',
                        disabled: Boolean(taxLock) && economy.policy !== id,
                    }))}
                />
                {taxLock && <p className="c3-why">{taxLock}</p>}
            </Section>
            <Section title={rules.dense.name || t('hall.dense')}>
                <Segmented
                    label={rules.dense.name || t('hall.dense')}
                    value={economy.dense ? 'on' : 'off'}
                    onChange={(value) => game.setDense(value === 'on')}
                    options={[
                        {
                            value: 'off',
                            label: t('hall.denseOff'),
                            disabled: Boolean(denseLock),
                        },
                        {
                            value: 'on',
                            label: t('hall.denseOn'),
                            hint: `+${Math.round(rules.dense.housing * 100)} %`,
                            disabled: Boolean(denseLock),
                        },
                    ]}
                />
                {denseLock && <p className="c3-why">{denseLock}</p>}
            </Section>
            {economy.loan > 0 && (
                <p className="c3-hint">
                    {t('loan.debt', {
                        n: formatExact(economy.loan),
                        rate: formatRate(-game.stats.budget.costs.interest),
                    })}
                </p>
            )}
            <Row label={t('hall.storage')}>
                {t('hall.storageValue', {
                    n: formatExact(game.stats.caps.food ?? 0),
                })}
            </Row>
        </Sheet>
    );
}
