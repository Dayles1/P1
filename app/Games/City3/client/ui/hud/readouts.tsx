/**
 * The top-left readouts (ui-spec §5.1): the money pill (era face, value,
 * net per year; the coin flips at an era change, cinnabar rim in arrears,
 * a saffron glint on a big gain), citizens with happiness, and the alert
 * badges (four at most, then «+N»).
 */

import { useEffect, useRef } from 'react';
import { useCtl, useGame, useHud, useUi } from '../context';
import { formatExact } from '../format';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';

export function MoneyPill() {
    const ctl = useCtl();
    const game = useGame();
    const money = useHud((s) => s.money);
    const ref = useRef<HTMLButtonElement>(null);
    const last = useRef(money.exact);

    // A gain of 5 % or more at once (reward, chest) glints once.
    useEffect(() => {
        const before = last.current;

        last.current = money.exact;

        if (
            before > 0 &&
            money.exact >= before * 1.05 &&
            money.exact - before > 50
        ) {
            const element = ref.current;

            element?.classList.remove('is-glint');
            void element?.offsetWidth;
            element?.classList.add('is-glint');
        }
    }, [money.exact]);

    const symbol = (era: string) => game.content.epochById(era).currency.symbol;
    const aria = t('hud.money.aria', {
        exact: formatExact(money.exact),
        face: money.faceShort.toLowerCase(),
        sign: money.netExact < 0 ? 'минус' : 'плюс',
        net: formatExact(Math.abs(money.netExact)),
    });

    return (
        <button
            ref={ref}
            type="button"
            className={`c3-money c3-chip${money.arrears ? ' is-arrears' : ''}`}
            onClick={() => ctl.open('city')}
            aria-label={aria}
            title={
                money.before
                    ? t('hud.money.faceChanged', {
                          now: symbol(money.face),
                          before: symbol(money.before),
                      })
                    : undefined
            }
        >
            <span
                key={money.face}
                className={`c3-money__face${money.before ? ' is-flip' : ''}`}
            >
                <CurrencyFace era={money.face} />
            </span>
            <span className="c3-money__text">
                <span className="c3-money__value c3-num c3-disp">
                    {money.text}
                </span>
                <span
                    className={`c3-money__delta c3-num ${money.sign < 0 ? 'c3-neg' : 'c3-pos'}`}
                >
                    {money.net}
                </span>
            </span>
        </button>
    );
}

export function CitizensChip() {
    const ctl = useCtl();
    const citizens = useHud((s) => s.citizens);
    const mood =
        citizens.happiness >= 65
            ? 'good'
            : citizens.happiness >= 40
              ? 'meh'
              : 'sad';

    return (
        <button
            type="button"
            className="c3-stat c3-chip"
            onClick={() => ctl.open('city')}
            aria-label={t('hud.citizens.aria', {
                pop: formatExact(citizens.popExact),
                target: formatExact(citizens.targetExact),
                h: citizens.happiness,
            })}
        >
            <Icon name="people" />
            <span className="c3-num">{citizens.pop}</span>
            <span
                className={`c3-stat__of c3-num${citizens.over ? ' c3-warn' : ''}`}
            >
                /{citizens.target}
            </span>
            <span className="c3-stat__div" />
            <Icon
                name={
                    mood === 'good'
                        ? 'face'
                        : mood === 'meh'
                          ? 'face-meh'
                          : 'face-sad'
                }
                className={`c3-face--${mood}`}
            />
            <span className="c3-num">{citizens.happiness}&nbsp;%</span>
        </button>
    );
}

const MAX_BADGES = 4;

export function AlertBadges() {
    const ctl = useCtl();
    const alerts = useHud((s) => s.alerts);
    const open = useUi((s) => s.popover === 'alerts');

    if (!alerts.length) {
        return null;
    }

    const shown =
        alerts.length > MAX_BADGES ? alerts.slice(0, MAX_BADGES - 1) : alerts;
    const rest = alerts.length - shown.length;

    return (
        <div
            className="c3-alerts"
            role="group"
            aria-label={t('hud.alerts.aria')}
        >
            {shown.map((alert) => (
                <button
                    key={alert.id}
                    type="button"
                    className={`c3-alert${alert.tone === 'warn' ? ' c3-alert--warn' : ''}`}
                    aria-label={alert.text}
                    title={alert.text}
                    onClick={() => ctl.openFix(alert.target)}
                >
                    <Icon name={alert.icon} />
                </button>
            ))}
            {rest > 0 && (
                <div className="c3-alerts__more">
                    <button
                        type="button"
                        className="c3-alert c3-alert--warn c3-num"
                        aria-expanded={open}
                        aria-label={t('hud.alerts.more', { n: rest })}
                        onClick={() => ctl.togglePopover('alerts')}
                    >
                        +{rest}
                    </button>
                    {open && (
                        <ul className="c3-pop c3-chip c3-alerts__list">
                            {alerts.map((alert) => (
                                <li key={alert.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            ctl.closePopover();
                                            ctl.openFix(alert.target);
                                        }}
                                    >
                                        <Icon
                                            name={alert.icon}
                                            className={
                                                alert.tone === 'bad'
                                                    ? 'c3-neg'
                                                    : 'c3-warn'
                                            }
                                        />
                                        {alert.text}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
