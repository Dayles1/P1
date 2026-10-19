/**
 * Buying an expansion strip (ui-spec §5.2 StripSheet, §6.6, gdd §5.2):
 * the feature as the title, the 14-strip diagram (owned malachite, this
 * one saffron), the feature lines, price and treasury, and «Купить полосу»
 * — or, short of money, «Не хватает N» and the treasury loan.
 */

import { useCtl, useGame, useSecond, useUi } from '../context';
import { formatExact, formatNumber } from '../format';
import { landOffer, offerLoan, stripCells, stripInfo } from '../game/strips';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';
import { Row } from '../kit/kit';
import { Section, Sheet } from './Sheet';
import { LoanOffer } from './TownHallSheet';

export function StripSheet() {
    const ctl = useCtl();
    const game = useGame();
    const side = useUi((s) => s.strip);

    useSecond();

    const offer = side ? landOffer(game, side) : null;

    if (!side || !offer) {
        return null;
    }

    const info = stripInfo(offer.minX);
    const cells = stripCells(game, offer);
    const width = offer.maxX - offer.minX + 1;
    const short = Math.max(0, offer.price - game.money);
    const loan = offerLoan(offer) ?? game.loanOffer();
    const affordable = offer.affordable && short <= 0;
    const face = game.epoch.id;
    const land = game.layout;

    return (
        <Sheet
            title={info.name}
            sub={t('strip.sub', {
                side:
                    side === 'west' ? t('strip.sideWest') : t('strip.sideEast'),
                w: width,
            })}
        >
            <Section>
                <div className="c3-strips" aria-hidden="true">
                    {cells.west.map((cell) => (
                        <i key={cell.minX} className={cell.state} />
                    ))}
                    <i className="home" />
                    {cells.east.map((cell) => (
                        <i key={cell.minX} className={cell.state} />
                    ))}
                </div>
                <div className="c3-strips-cap">
                    <span>{t('strip.west')}</span>
                    <span>{t('strip.yours')}</span>
                    <span>{t('strip.east')}</span>
                </div>
            </Section>
            <ul className="c3-lst">
                {info.features.map((feature) => (
                    <li key={feature.title} className="c3-li">
                        <Icon name={feature.icon} className="c3-saffron" />
                        <span>
                            {feature.title}
                            <span className="c3-li__sub">{feature.detail}</span>
                        </span>
                        <span />
                    </li>
                ))}
                <li className="c3-li">
                    <Icon name="house" className="c3-mut" />
                    <span>
                        {t('strip.land')}
                        <span className="c3-li__sub">
                            {t('strip.landSub', {
                                land: formatExact(width * land.beachY),
                                beach: formatExact(
                                    width * (land.seaY - land.beachY),
                                ),
                            })}
                        </span>
                    </span>
                    <span />
                </li>
            </ul>
            <div className="c3-rule" />
            <Section>
                <Row label={t('strip.price')}>{formatExact(offer.price)}</Row>
                <Row label={t('strip.treasury')}>{formatExact(game.money)}</Row>
            </Section>
            <button
                type="button"
                className="c3-btn c3-btn--primary c3-btn--wide"
                disabled={!affordable}
                onClick={() => ctl.buyStrip(side)}
            >
                {affordable
                    ? t('strip.buy')
                    : t('strip.short', { n: formatExact(short) })}
                <span className="c3-cost c3-num">
                    <CurrencyFace era={face} />
                    {formatNumber(offer.price)}
                </span>
            </button>
            {!affordable && <LoanOffer offer={loan} />}
        </Sheet>
    );
}
