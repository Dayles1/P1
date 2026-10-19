/**
 * The City sheet, the budget (ui-spec §5.2 CitySheet, gdd §11.2): the
 * year's totals, «Главные потери» with a fix each, income and cost bars,
 * the stocks with their cap and rates (waste in cinnabar), working hands,
 * the power gauge, happiness, homes against P*, and the arrears banner
 * with the mothballed buildings to reopen.
 */

import type { Budget } from '../../engine/sim/game';
import { useCtl, useGame, useSecond } from '../context';
import { formatExact, formatNumber, formatRate, MINUS } from '../format';
import type { FixTarget } from '../game/advisor';
import { t, word } from '../i18n';
import type { CopyKey } from '../i18n';
import { Icon } from '../icons/Icon';
import { Row } from '../kit/kit';
import { Section, Sheet } from './Sheet';

function BarRow({
    label,
    amount,
    scale,
    cost,
}: {
    label: string;
    amount: number;
    scale: number;
    cost?: boolean;
}) {
    return (
        <div
            className={`c3-brow${cost ? ' c3-brow--cost' : ''}`}
            title={formatExact(amount)}
        >
            <span>{label}</span>
            <span className="c3-brow__track">
                <b
                    style={{
                        width: `${Math.min(100, (amount / scale) * 100)}%`,
                    }}
                />
            </span>
            <span className="c3-num">{formatNumber(amount)}</span>
        </div>
    );
}

interface Loss {
    text: string;
    amount: number;
    fix: FixTarget;
    fixLabel: string;
}

export function CitySheet() {
    const ctl = useCtl();
    const game = useGame();

    useSecond();

    const stats = game.stats;
    const budget = stats.budget;
    const scale = Math.max(1, budget.gross, budget.spent);
    const mothballed = [...game.buildings.values()].filter((b) => b.mothballed);
    const arrears = stats.arrears || game.state.economy.arrears;
    const income = (
        Object.entries(budget.income) as [keyof Budget['income'], number][]
    ).filter(([id, amount]) => id === 'tax' || amount > 0.5);
    const upkeep = Object.entries(budget.upkeepBy)
        .filter(([, amount]) => amount > 0.5)
        .sort(([, a], [, b]) => b - a);
    const imports = (['food', 'fuel', 'power', 'interest'] as const).filter(
        (id) => budget.costs[id] > 0.5,
    );
    const losses: Loss[] = [];

    if (budget.costs.food > 0.5) {
        losses.push({
            text: t('city.loss.food'),
            amount: budget.costs.food,
            fix: { kind: 'build', tab: 'food', type: 'farm' },
            fixLabel: t('city.fix.farm'),
        });
    }

    if (budget.costs.power + budget.costs.fuel > 0.5) {
        losses.push({
            text: t('city.loss.power'),
            amount: budget.costs.power + budget.costs.fuel,
            fix: { kind: 'build', tab: 'energy' },
            fixLabel: t('city.fix.power'),
        });
    }

    if (budget.costs.interest > 0.5) {
        losses.push({
            text: t('city.loss.interest'),
            amount: budget.costs.interest,
            fix: { kind: 'sheet', sheet: 'hall' },
            fixLabel: t('city.fix.repay'),
        });
    }

    if (stats.unemployment > 0.05) {
        const share =
            game.content.world.economy.unemploymentTaxLoss * stats.unemployment;
        const lost = share < 1 ? (stats.tax * share) / (1 - share) : 0;

        if (lost > 0.5) {
            losses.push({
                text: t('city.loss.jobless'),
                amount: lost,
                fix: { kind: 'build', tab: 'industry' },
                fixLabel: t('city.fix.show'),
            });
        }
    }

    const top = upkeep[0];

    if (top && losses.length < 3) {
        losses.push({
            text: t('city.loss.upkeep', {
                name: t(`cat.${top[0]}` as CopyKey).toLowerCase(),
            }),
            amount: top[1],
            fix: { kind: 'sheet', sheet: 'city' },
            fixLabel: t('city.fix.show'),
        });
    }

    losses.sort((a, b) => b.amount - a.amount);

    const short = Object.values(stats.staff).some((share) => share < 0.95);
    const labour = short
        ? t('city.labourShort', { pct: Math.round(stats.employment * 100) })
        : stats.unemployment > 0.05
          ? t('city.labourJobless', {
                pct: Math.round(stats.unemployment * 100),
                n: formatNumber(
                    (game.content.world.economy.unemploymentTaxLoss *
                        stats.unemployment *
                        stats.tax) /
                        Math.max(
                            0.01,
                            1 -
                                game.content.world.economy.unemploymentTaxLoss *
                                    stats.unemployment,
                        ),
                ),
            })
          : t('city.labourOk', {
                workers: formatExact(stats.workers),
                jobs: formatExact(stats.jobs),
            });
    const waste = stats.flows?.waste ?? {};
    const stocks = game
        .visibleResources()
        .filter((resource) => resource.kind === 'stock');

    return (
        <Sheet
            title={t('city.title')}
            sub={t('city.sub2', { money: formatExact(game.money) })}
        >
            {arrears && (
                <div className="c3-banner c3-banner--bad">
                    <Icon name="coin-off" size="s" />
                    {t('city.arrears', {
                        n: mothballed.length,
                        word: word(mothballed.length, 'buildings'),
                    })}
                </div>
            )}
            <dl className="c3-facts">
                <div className="c3-fact">
                    <dt>{t('city.income')}</dt>
                    <dd className="c3-num">{formatExact(budget.gross)}</dd>
                </div>
                <div className="c3-fact">
                    <dt>{t('city.spent')}</dt>
                    <dd className="c3-num">{formatExact(budget.spent)}</dd>
                </div>
                <div className="c3-fact">
                    <dt>{t('city.net')}</dt>
                    <dd
                        className={`c3-num ${budget.net < 0 ? 'c3-neg' : 'c3-pos'}`}
                    >
                        {budget.net < 0 ? MINUS : '+'}
                        {formatExact(Math.abs(budget.net))}
                    </dd>
                </div>
            </dl>
            <Section title={t('city.losses')}>
                {losses.length ? (
                    losses.slice(0, 3).map((loss) => (
                        <div key={loss.text} className="c3-loss">
                            <span>
                                {loss.text}:{' '}
                                <b className="c3-neg c3-num">
                                    {formatRate(-loss.amount)}
                                </b>
                            </span>
                            <button
                                type="button"
                                className="c3-btn c3-btn--small"
                                onClick={() => ctl.openFix(loss.fix)}
                            >
                                {loss.fixLabel}
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="c3-hint">{t('city.noLosses')}</p>
                )}
            </Section>
            <Section title={t('city.incomeBars')}>
                <div className="c3-bars">
                    {income.map(([id, amount]) => (
                        <BarRow
                            key={id}
                            label={t(`city.in.${id}` as CopyKey)}
                            amount={amount}
                            scale={scale}
                        />
                    ))}
                </div>
            </Section>
            <Section title={t('city.costBars')}>
                {upkeep.length + imports.length === 0 ? (
                    <p className="c3-hint">{t('city.noCosts')}</p>
                ) : (
                    <div className="c3-bars">
                        {upkeep.map(([key, amount]) => (
                            <BarRow
                                key={key}
                                label={t(`cat.${key}` as CopyKey)}
                                amount={amount}
                                scale={scale}
                                cost
                            />
                        ))}
                        {imports.map((id) => (
                            <BarRow
                                key={id}
                                label={t(`city.out.${id}` as CopyKey)}
                                amount={budget.costs[id]}
                                scale={scale}
                                cost
                            />
                        ))}
                    </div>
                )}
            </Section>
            <Section
                title={t('city.stocks', {
                    cap: formatExact(stats.caps.food ?? 0),
                })}
            >
                {stocks.map((resource) => {
                    const rate = stats.rates[resource.id] ?? 0;
                    const lost = waste[resource.id] ?? 0;

                    return (
                        <Row
                            key={resource.id}
                            label={
                                resource.faces?.[game.epoch.id] ?? resource.name
                            }
                        >
                            {formatExact(
                                game.state.resources[resource.id] ?? 0,
                            )}{' '}
                            <span className={rate < 0 ? 'c3-neg' : 'c3-pos'}>
                                {formatRate(rate)}
                            </span>
                            {lost > 0.05 && (
                                <span className="c3-neg">
                                    {' '}
                                    ·{' '}
                                    {t('city.waste', { n: formatNumber(lost) })}
                                </span>
                            )}
                        </Row>
                    );
                })}
                <Row label={t('city.labour')}>
                    <span
                        className={
                            short || stats.unemployment > 0.05 ? 'c3-warn' : ''
                        }
                    >
                        {labour}
                    </span>
                </Row>
                {(stats.powerDemand > 0 || stats.powerSupply > 0) && (
                    <Row label={t('city.power')}>
                        <span
                            className={
                                stats.powerSupply < stats.powerDemand
                                    ? 'c3-neg'
                                    : ''
                            }
                        >
                            {t('city.powerValue', {
                                supply: formatNumber(stats.powerSupply),
                                demand: formatNumber(stats.powerDemand),
                            })}
                        </span>
                    </Row>
                )}
                <Row label={t('city.happiness')}>
                    <span
                        className={
                            stats.happiness >= 65
                                ? 'c3-pos'
                                : stats.happiness >= 40
                                  ? 'c3-warn'
                                  : 'c3-neg'
                        }
                    >
                        {Math.round(stats.happiness)}&nbsp;%
                    </span>
                </Row>
                <Row label={t('city.homes')}>
                    {t('city.homesValue', {
                        pop: formatExact(game.state.population),
                        target: formatExact(stats.target),
                        housing: formatExact(stats.housing),
                    })}
                </Row>
            </Section>
            {mothballed.length > 0 && (
                <Section title={t('city.mothballed')}>
                    <ul className="c3-lst">
                        {mothballed.map((building) => (
                            <li key={building.uid} className="c3-li">
                                <Icon name="lock" className="c3-warn" />
                                <button
                                    type="button"
                                    className="c3-link c3-link--left"
                                    onClick={() => ctl.select(building.uid)}
                                >
                                    {game.nameOf(building)}
                                </button>
                                <button
                                    type="button"
                                    className="c3-btn c3-btn--small"
                                    onClick={() => game.reopen(building.uid)}
                                >
                                    {t('inspector.reopen')}
                                </button>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </Sheet>
    );
}
