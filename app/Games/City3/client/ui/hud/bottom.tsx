/**
 * The thumb zone (ui-spec §5.1): the Advisor line (tap → its fix;
 * long-press → «Скрыть совет» until another rule fires), the four thumbs
 * (Строить in saffron; the Улучшить count; the Задачи dot) and the map
 * buttons (layers; compass: tap turns 90°, hold or double-tap returns to
 * the Town Hall, north up).
 */

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useCtl, useHud, useUi } from '../context';
import { formatExact } from '../format';
import { t } from '../i18n';
import { Icon } from '../icons/Icon';
import { Kbd } from '../kit/kit';
import type { SheetId } from '../store/ui-store';

/** Calls `onHold` after 500 ms of pressing; `onTap` otherwise. */
function usePress(onTap: () => void, onHold: () => void) {
    const state = useRef<{ timer: number; held: boolean } | null>(null);

    return {
        onPointerDown: () => {
            const timer = window.setTimeout(() => {
                if (state.current) {
                    state.current.held = true;
                }

                onHold();
            }, 500);

            state.current = { timer, held: false };
        },
        onPointerUp: () => {
            if (state.current) {
                window.clearTimeout(state.current.timer);
            }
        },
        onPointerLeave: () => {
            if (state.current) {
                window.clearTimeout(state.current.timer);
            }
        },
        onClick: () => {
            const held = state.current?.held;

            state.current = null;

            if (!held) {
                onTap();
            }
        },
    };
}

export function AdvisorLine() {
    const ctl = useCtl();
    const advisor = useHud((s) => s.advisor);
    const hidden = useUi((s) => s.advisorHidden);
    const press = usePress(
        () => advisor && ctl.openFix(advisor.target),
        () => advisor && ctl.hideAdvisor(advisor.id),
    );

    if (!advisor) {
        return null;
    }

    if (hidden === advisor.id) {
        return (
            <button
                type="button"
                className="c3-advisor c3-advisor--bulb c3-chip"
                aria-label={t('advisor.showAgain')}
                onClick={() => ctl.hideAdvisor('')}
            >
                <Icon name="bulb" />
            </button>
        );
    }

    return (
        <button
            type="button"
            className="c3-advisor c3-chip"
            aria-label={t('advisor.aria', { text: advisor.text })}
            title={advisor.text}
            {...press}
            onContextMenu={(event) => {
                event.preventDefault();
                ctl.hideAdvisor(advisor.id);
            }}
        >
            <Icon name="bulb" />
            <span className="c3-advisor__text">{advisor.text}</span>
            <Icon name="chev" />
        </button>
    );
}

function Thumb({
    sheet,
    icon,
    label,
    keyName,
    primary,
    onClick,
    children,
}: {
    sheet: SheetId;
    icon: 'build' | 'upgrade' | 'goals' | 'city';
    label: string;
    keyName: string;
    primary?: boolean;
    onClick: () => void;
    children?: ReactNode;
}) {
    const open = useUi((s) => s.sheet === sheet);

    return (
        <button
            type="button"
            className={`c3-btn c3-thumb${primary ? ' c3-btn--primary' : ''}${open ? ' is-open' : ''}`}
            aria-keyshortcuts={keyName}
            aria-pressed={open}
            onClick={onClick}
        >
            <Icon name={icon} />
            <span>{label}</span>
            {children}
            <Kbd>{keyName}</Kbd>
        </button>
    );
}

export function ThumbBar() {
    const ctl = useCtl();
    const counts = useHud((s) => s.counts);

    return (
        <nav className="c3-thumbs" aria-label={t('thumb.nav')}>
            <Thumb
                sheet="build"
                icon="build"
                label={t('thumb.build')}
                keyName="B"
                primary
                onClick={() =>
                    ctl.state.sheet === 'build' ? ctl.close() : ctl.openBuild()
                }
            />
            <Thumb
                sheet="upgrade"
                icon="upgrade"
                label={t('thumb.upgrade')}
                keyName="U"
                onClick={() => ctl.toggle('upgrade')}
            >
                {counts.upgrade > 0 && (
                    <b
                        className="c3-count c3-num"
                        aria-label={t('thumb.upgradeCount', {
                            n: formatExact(counts.upgrade),
                        })}
                    >
                        {counts.upgrade > 99 ? '99+' : counts.upgrade}
                    </b>
                )}
            </Thumb>
            <Thumb
                sheet="goals"
                icon="goals"
                label={t('thumb.goals')}
                keyName="G"
                onClick={() => ctl.toggle('goals')}
            >
                {counts.goals && (
                    <b
                        className={`c3-dot${counts.goals === 'story' ? ' c3-dot--story' : ''}`}
                        aria-label={
                            counts.goals === 'reward'
                                ? t('thumb.reward')
                                : t('thumb.story')
                        }
                    />
                )}
            </Thumb>
            <Thumb
                sheet="city"
                icon="city"
                label={t('thumb.city')}
                keyName="C"
                onClick={() => ctl.toggle('city')}
            />
        </nav>
    );
}

export function MapButtons() {
    const ctl = useCtl();
    const layer = useUi((s) => s.layer);
    const compass = usePress(
        () => ctl.rotateQuarter(),
        () => ctl.home(),
    );

    return (
        <>
            <button
                type="button"
                className="c3-btn c3-round"
                aria-label={layer ? t('map.layersOn') : t('map.layers')}
                aria-keyshortcuts="L"
                onClick={() => ctl.toggle('overlays')}
            >
                <Icon name="layers" />
                {layer && <i className="c3-round__dot" />}
            </button>
            <button
                type="button"
                className="c3-btn c3-round"
                aria-label={t('map.compass')}
                aria-keyshortcuts="Home"
                {...compass}
                onDoubleClick={() => ctl.home()}
            >
                <Icon name="compass" />
            </button>
        </>
    );
}
