/**
 * The smaller sheets: layers (ui-spec §5.2 OverlaysSheet: the views the
 * renderer draws now), the Architects' Bureau (blueprints, gdd §8.1),
 * «Что нового» after an era entry (gdd §2.4), and the price sheet — how
 * an upgrade's price comes about (gdd §4.9).
 */

import { MATERIALS } from '../../engine/content/registry';
import { useCtl, useGame, useSecond, useUi } from '../context';
import { formatExact } from '../format';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';
import { CostLine } from '../kit/kit';
import type { Layer } from '../store/ui-store';
import { Section, Sheet } from './Sheet';
import { LoanOffer } from './TownHallSheet';

const LAYERS: {
    id: Layer | null;
    icon: IconName;
    label: 'layers.none' | 'layers.xray' | 'layers.districts';
    hint: 'layers.noneHint' | 'layers.xrayHint' | 'layers.districtsHint';
}[] = [
    { id: null, icon: 'city', label: 'layers.none', hint: 'layers.noneHint' },
    {
        id: 'xray',
        icon: 'layers',
        label: 'layers.xray',
        hint: 'layers.xrayHint',
    },
    {
        id: 'districts',
        icon: 'district',
        label: 'layers.districts',
        hint: 'layers.districtsHint',
    },
];

export function OverlaysSheet() {
    const ctl = useCtl();
    const layer = useUi((s) => s.layer);

    return (
        <Sheet title={t('layers.title')} sub={t('layers.sub')}>
            <div
                className="c3-lst"
                role="radiogroup"
                aria-label={t('layers.title')}
            >
                {LAYERS.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        role="radio"
                        aria-checked={layer === item.id}
                        className={`c3-li c3-li--button${layer === item.id ? ' is-on' : ''}`}
                        onClick={() => ctl.setLayer(item.id)}
                    >
                        <Icon
                            name={item.icon}
                            className={layer === item.id ? 'c3-era' : 'c3-mut'}
                        />
                        <span>
                            {t(item.label)}
                            <span className="c3-li__sub">{t(item.hint)}</span>
                        </span>
                        <span
                            className={`c3-radio${layer === item.id ? ' is-on' : ''}`}
                        />
                    </button>
                ))}
            </div>
        </Sheet>
    );
}

/** The legend chip of an active layer in the quest row (ui-spec §5.2). */
export function LayerChip() {
    const ctl = useCtl();
    const layer = useUi((s) => s.layer);

    if (!layer) {
        return null;
    }

    const item = LAYERS.find((entry) => entry.id === layer)!;

    return (
        <div className="c3-legend c3-chip">
            <Icon name={item.icon} size="s" className="c3-era" />
            <span>{t('layers.chip', { name: t(item.label) })}</span>
            <button
                type="button"
                className="c3-legend__x"
                aria-label={t('layers.off')}
                onClick={() => ctl.setLayer(null)}
            >
                <Icon name="x" size="xs" />
            </button>
        </div>
    );
}

export function BureauSheet() {
    const game = useGame();

    useSecond();

    const bureau = game.bureau;
    const blueprints = game.content.blueprints.filter(
        (blueprint) =>
            game.content.epochOrder(blueprint.epoch) <= game.state.epoch + 1,
    );

    return (
        <Sheet
            title={t('bureau.title')}
            sub={
                bureau
                    ? t('bureau.level', { n: bureau.level })
                    : t('bureau.sub')
            }
        >
            <p className="c3-hint">
                {bureau ? t('bureau.lead') : t('bureau.none')}
            </p>
            <ul className="c3-lst">
                {blueprints.map((blueprint) => {
                    const unlocked = game.state.blueprints.includes(
                        blueprint.id,
                    );
                    const lock = unlocked
                        ? null
                        : game.blueprintLock(blueprint);
                    const fits = blueprint.buildings.length
                        ? blueprint.buildings
                              .map((id) =>
                                  game.content.hasBuilding(id)
                                      ? game.content.building(id).name
                                      : id,
                              )
                              .join(', ')
                        : t('bureau.any');

                    return (
                        <li
                            key={blueprint.id}
                            className={`c3-li${unlocked ? ' c3-li--done' : ''}`}
                        >
                            <span
                                className="c3-swatch-stack"
                                aria-hidden="true"
                            >
                                {Object.values(blueprint.colors)
                                    .slice(0, 3)
                                    .map((color) => (
                                        <i
                                            key={color}
                                            style={{ background: color }}
                                        />
                                    ))}
                            </span>
                            <span>
                                {blueprint.name}
                                <span className="c3-li__sub">
                                    {
                                        game.content.epochById(blueprint.epoch)
                                            .name
                                    }{' '}
                                    · {t('bureau.level', { n: blueprint.tier })}
                                </span>
                                <span className="c3-li__sub">
                                    {t('bureau.for', { list: fits })}
                                </span>
                                {lock && (
                                    <span className="c3-li__sub c3-warn">
                                        {lock}
                                    </span>
                                )}
                            </span>
                            {unlocked ? (
                                <span className="c3-pos">
                                    {t('bureau.ready')}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    className="c3-btn c3-btn--primary c3-btn--small"
                                    disabled={
                                        Boolean(lock) ||
                                        !game.canAfford(blueprint.cost)
                                    }
                                    onClick={() =>
                                        game.unlockBlueprint(blueprint.id)
                                    }
                                >
                                    {t('bureau.open')}
                                    <CostLine cost={blueprint.cost} />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Sheet>
    );
}

export function WhatsNewSheet() {
    const game = useGame();
    const era = game.epoch;
    const previous = game.content.epoch(Math.max(0, game.state.epoch - 1));
    const unlocks = game.content.buildings.filter(
        (def) => !def.hidden && def.levels[0].epoch === era.id,
    );
    const upgrades = game.content.buildings.filter(
        (def) =>
            !def.hidden &&
            def.levels[0].epoch !== era.id &&
            def.levels.some((level) => level.epoch === era.id),
    );
    const techs = game.content.techs.filter((tech) => tech.epoch === era.id);
    const last = game.chronicle().at(-1);

    return (
        <Sheet title={t('whatsnew.title', { era: era.name })} sub={era.tagline}>
            <p className="c3-hint">
                <CurrencyFace era={era.id} className="c3-cur--inline" />{' '}
                {t('whatsnew.coin', {
                    now: era.currency.symbol,
                    before: previous.currency.symbol,
                    name: era.currency.name,
                })}
            </p>
            {last && last.stars > 0 && (
                <p className="c3-hint">
                    {t('whatsnew.golden', { pct: last.stars * 5 })}
                </p>
            )}
            <Section title={t('whatsnew.buildings')}>
                <div className="c3-needs">
                    {unlocks.map((def) => (
                        <span
                            key={def.id}
                            className="c3-need"
                            title={def.description}
                        >
                            {def.levels[0].name}
                        </span>
                    ))}
                </div>
            </Section>
            {upgrades.length > 0 && (
                <Section title={t('whatsnew.levels')}>
                    <div className="c3-needs">
                        {upgrades.map((def) => (
                            <span key={def.id} className="c3-need">
                                {def.levels.find(
                                    (level) => level.epoch === era.id,
                                )?.name ?? def.name}
                            </span>
                        ))}
                    </div>
                </Section>
            )}
            <Section title={t('whatsnew.techs')}>
                <div className="c3-needs">
                    {techs.map((tech) => (
                        <span
                            key={tech.id}
                            className="c3-need"
                            title={tech.description}
                        >
                            <Icon name="flask" size="xs" />
                            {tech.name}
                        </span>
                    ))}
                </div>
            </Section>
            <p className="c3-hint">{t('whatsnew.note')}</p>
        </Sheet>
    );
}

export function PriceSheet() {
    const ctl = useCtl();
    const game = useGame();
    const price = useUi((s) => s.price);

    useSecond();

    const building = price ? game.buildings.get(price.uid) : undefined;

    if (!price || !building) {
        return null;
    }

    const economy = game.content.world.economy;
    const money = game.content.currency;
    const materials = game.content.resource(MATERIALS);
    const target = game.content.level(game.def(building), price.level);
    const breakdown = game.priceBreakdown(building, price.level);
    const quote = breakdown.quote;
    const short = Math.max(0, quote.total - game.money);
    const center = game.roleOf(building) === 'center';
    const face = game.epoch.id;

    return (
        <Sheet title={t('price.title', { name: target.name })}>
            <table className="c3-price">
                <tbody>
                    <tr>
                        <td>{t('price.list')}</td>
                        <td className="c3-num">
                            <CurrencyFace era={face} />
                            {formatExact(breakdown.list[money] ?? 0)} +{' '}
                            {formatExact(breakdown.list[MATERIALS] ?? 0)}
                        </td>
                    </tr>
                    {!center && (
                        <tr>
                            <td>
                                {t('price.credit', {
                                    pct: Math.round(economy.tradeIn * 100),
                                    paid: formatExact(breakdown.paid),
                                })}
                            </td>
                            <td className="c3-num">
                                −{formatExact(breakdown.credit)}
                            </td>
                        </tr>
                    )}
                    {breakdown.floor && (
                        <tr>
                            <td>
                                {t('price.floor', {
                                    pct: Math.round(economy.upgradeFloor * 100),
                                })}
                            </td>
                            <td />
                        </tr>
                    )}
                    {breakdown.spirit > 0 && (
                        <tr>
                            <td>{t('price.spirit')}</td>
                            <td className="c3-num">
                                −{Math.round(breakdown.spirit * 100)} %
                            </td>
                        </tr>
                    )}
                    <tr>
                        <td>{t('price.money')}</td>
                        <td className="c3-num">{formatExact(quote.money)}</td>
                    </tr>
                    {quote.mat > 0 && (
                        <tr>
                            <td>
                                {t('price.mat', {
                                    name: materials?.name ?? MATERIALS,
                                    stock: formatExact(quote.fromStock),
                                })}
                                {quote.bought > 0 &&
                                    t('price.matBought', {
                                        n: formatExact(quote.bought),
                                    })}
                            </td>
                            <td className="c3-num">
                                {quote.importMoney > 0
                                    ? `+${formatExact(quote.importMoney)}`
                                    : '—'}
                            </td>
                        </tr>
                    )}
                    <tr className="c3-price__total">
                        <td>{t('price.total')}</td>
                        <td className="c3-num">
                            <CurrencyFace era={face} />
                            {formatExact(quote.total)}
                        </td>
                    </tr>
                    <tr>
                        <td>{t('price.treasury')}</td>
                        <td className="c3-num">{formatExact(game.money)}</td>
                    </tr>
                </tbody>
            </table>
            {!center && (
                <p className="c3-hint">
                    {t('price.note', {
                        pct: Math.round(economy.tradeIn * 100),
                        refund: Math.round(economy.refundShare * 100),
                        n: formatExact(game.refund(building)),
                    })}
                </p>
            )}
            {short > 0 && (
                <>
                    <p className="c3-why">
                        {t('price.short', { n: formatExact(short) })}
                    </p>
                    <LoanOffer offer={game.loanOffer()} />
                </>
            )}
            <button
                type="button"
                className="c3-btn c3-btn--quiet"
                onClick={() =>
                    center ? ctl.open('hall') : ctl.select(building.uid)
                }
            >
                <Icon name="back" size="s" />
                {center ? t('hall.title') : game.nameOf(building)}
            </button>
        </Sheet>
    );
}
