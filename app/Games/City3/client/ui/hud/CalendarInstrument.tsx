/**
 * The calendar instrument, the HUD's one bold element (ui-spec §1, §5.1):
 * a ring that fills once per game year in the era accent with the speed
 * in its centre (tap → speed), and the main button (tap → Chronicle;
 * long-press or hover → lead tooltip) with the year, the lead with its
 * pennant, the era name and the race line. On desktop the speed is an
 * always-visible segmented control beside it.
 */

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCtl, useHud, useUi } from '../context';
import { formatExact, formatSigned } from '../format';
import { t } from '../i18n';
import { Icon } from '../icons/Icon';
import { useFrame } from '../store/frame';

const RING = 2 * Math.PI * 16.4;

/** Six era segments, the calendar tick, the city's pennant and the lead between. */
export function RaceLine({
    now,
    city,
    falling,
    large = false,
    labels,
}: {
    now: number;
    city: number;
    falling: boolean;
    large?: boolean;
    labels?: readonly string[];
}) {
    const from = Math.min(now, city);
    const width = Math.abs(city - now);

    return (
        <span
            className={`c3-race${large ? ' c3-race--large' : ''}${falling ? ' is-falling' : ''}`}
            aria-hidden="true"
        >
            <span className="c3-race__track">
                {Array.from({ length: 6 }, (_, index) => (
                    <span key={index} className="c3-race__seg" />
                ))}
                <span
                    className="c3-race__lead"
                    style={{ left: `${from * 100}%`, width: `${width * 100}%` }}
                />
                <span
                    className="c3-race__now"
                    style={{ left: `${now * 100}%` }}
                />
                <span
                    className="c3-race__city"
                    style={{ left: `${city * 100}%` }}
                />
            </span>
            {labels && (
                <span className="c3-race__labels">
                    {labels.map((label) => (
                        <span key={label}>{label}</span>
                    ))}
                </span>
            )}
        </span>
    );
}

export function SpeedOptions() {
    const ctl = useCtl();
    const speed = useHud((s) => s.speed);
    const tester = useHud((s) => s.tester);
    const options = tester ? [0, 1, 2, 5, 20, 50] : [0, 1, 2, 5];

    return (
        <div
            className="c3-speed c3-chip"
            role="group"
            aria-label={t('hud.speed.group')}
        >
            {options.map((value) => (
                <button
                    key={value}
                    type="button"
                    className={`c3-speed__opt${value > 5 ? ' c3-speed__opt--test' : ''}`}
                    aria-pressed={speed === value}
                    aria-label={
                        value
                            ? t('hud.speed.option', { n: value })
                            : t('hud.speed.pause')
                    }
                    aria-keyshortcuts={value === 0 ? 'Space' : undefined}
                    onClick={() => {
                        ctl.setSpeed(value);
                        ctl.closePopover();
                    }}
                >
                    {value === 0 ? <Icon name="pause" /> : `×${value}`}
                </button>
            ))}
            {tester && (
                <span className="c3-speed__tag">{t('hud.speed.test')}</span>
            )}
        </div>
    );
}

export function CalendarInstrument() {
    const ctl = useCtl();
    const calendar = useHud((s) => s.calendar);
    const speed = useHud((s) => s.speed);
    const popover = useUi((s) => s.popover);
    const fill = useRef<SVGCircleElement>(null);
    const press = useRef<{ timer: number; fired: boolean } | null>(null);

    useFrame(() => {
        const circle = fill.current;

        if (circle) {
            const progress = ctl.yearProgress();

            circle.style.strokeDasharray = `${(RING * progress).toFixed(2)} ${RING}`;
        }
    });

    const startPress = (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') {
            return;
        }

        const timer = window.setTimeout(() => {
            if (press.current) {
                press.current.fired = true;
            }

            ctl.togglePopover('lead');
        }, 500);

        press.current = { timer, fired: false };
    };
    const endPress = () => {
        if (press.current) {
            window.clearTimeout(press.current.timer);
        }
    };
    const lead = calendar.lead;
    const paused = speed === 0;

    return (
        <div
            className={`c3-cal c3-chip${paused ? ' is-paused' : ''}${calendar.falling ? ' is-falling' : ''}${calendar.behind ? ' is-behind' : ''}`}
        >
            <button
                type="button"
                className="c3-cal__ring"
                aria-haspopup="true"
                aria-expanded={popover === 'speed'}
                aria-label={
                    paused
                        ? t('hud.speed.pausedAria')
                        : t('hud.speed.aria', { n: speed })
                }
                onClick={() => ctl.togglePopover('speed')}
            >
                <svg viewBox="0 0 40 40" aria-hidden="true">
                    <circle
                        className="c3-cal__track"
                        cx="20"
                        cy="20"
                        r="16.4"
                    />
                    <circle
                        ref={fill}
                        className="c3-cal__fill"
                        cx="20"
                        cy="20"
                        r="16.4"
                        strokeDasharray={`0 ${RING}`}
                    />
                </svg>
                <span className="c3-cal__speed c3-num">
                    {paused ? <Icon name="pause" /> : `×${speed}`}
                </span>
            </button>
            <button
                type="button"
                className="c3-cal__main"
                aria-label={t('hud.calendar.aria', {
                    year: calendar.year,
                    era: calendar.era,
                    lead: formatSigned(lead),
                })}
                aria-describedby="c3-leadtip"
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerCancel={endPress}
                onPointerLeave={endPress}
                onClick={() => {
                    if (press.current?.fired) {
                        press.current = null;

                        return;
                    }

                    ctl.open('chronicle');
                }}
            >
                <span className="c3-cal__year c3-num c3-disp">
                    {calendar.year}
                    <small>{t('hud.calendar.year')}</small>
                </span>
                <span className="c3-cal__lead c3-num">
                    <Icon name={calendar.falling ? 'flag-down' : 'flag'} />
                    {calendar.behind ? formatExact(lead) : formatSigned(lead)}
                </span>
                <span className="c3-cal__era">{calendar.era}</span>
                <RaceLine
                    now={calendar.raceNow}
                    city={calendar.raceCity}
                    falling={calendar.falling}
                />
            </button>
            <div
                id="c3-leadtip"
                role="tooltip"
                className={`c3-leadtip c3-chip${popover === 'lead' ? ' is-open' : ''}`}
            >
                {calendar.tooltip}
            </div>
        </div>
    );
}
