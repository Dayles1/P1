/**
 * The pinned main quest (ui-spec §5.1 QuestChip, gdd §9.2): the next era
 * with one pip per gate line; tap expands the open lines with bars and
 * «Открыть ратушу» (always expanded as a card on desktop). All lines
 * green: «Ратуша готова к улучшению». Building: «…» строится with a bar.
 */

import type { GateLine } from '../../engine/sim/game';
import { useCtl, useHud, useUi } from '../context';
import { formatNumber } from '../format';
import { t, word } from '../i18n';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/sprite';
import { Bar } from '../kit/kit';

const LINE_ICONS: Record<GateLine['kind'], IconName> = {
    population: 'people',
    item: 'factory',
    discoveries: 'flask',
};

export function QuestChip() {
    const ctl = useCtl();
    const gate = useHud((s) => s.gate);
    const open = useUi((s) => s.popover === 'quest');

    if (gate.state === 'last' || !gate.next) {
        return null;
    }

    const label =
        gate.state === 'ready'
            ? t('hud.quest.ready')
            : gate.state === 'building'
              ? t('hud.quest.building', {
                    hall: gate.hall,
                    n: gate.yearsLeft,
                    word: word(gate.yearsLeft, 'years'),
                })
              : gate.next;
    const lines = gate.lines.filter((line) => !line.done).slice(0, 3);

    return (
        <div className={`c3-quest${gate.state === 'ready' ? ' is-ready' : ''}`}>
            <button
                type="button"
                className="c3-quest__chip c3-chip"
                aria-expanded={open}
                aria-label={t('hud.quest.aria', {
                    next: gate.next,
                    done: gate.done,
                    total: gate.total,
                })}
                title={label}
                onClick={() =>
                    gate.state === 'open'
                        ? ctl.togglePopover('quest')
                        : ctl.open('hall')
                }
            >
                <Icon name="hall" className="c3-quest__hall" />
                <span className="c3-quest__label">{label}</span>
                {gate.state === 'open' && (
                    <span className="c3-pips" aria-hidden="true">
                        {gate.lines.map((line) => (
                            <i
                                key={line.label}
                                className={line.done ? 'on' : ''}
                            />
                        ))}
                    </span>
                )}
                <Icon name="chev" className="c3-quest__chev" />
            </button>
            {gate.state === 'building' && (
                <span className="c3-quest__build">
                    <Bar value={gate.buildShare} />
                </span>
            )}
            {gate.state === 'open' && (
                <div
                    className={`c3-quest__lines c3-chip${open ? ' is-open' : ''}`}
                >
                    {lines.map((line) => (
                        <div key={line.label} className="c3-ql">
                            <Icon
                                name={LINE_ICONS[line.kind]}
                                className="c3-mut"
                            />
                            <span className="c3-ql__label">{line.label}</span>
                            <span className="c3-num">
                                {formatNumber(line.current)} /{' '}
                                {formatNumber(line.target)}
                            </span>
                            <span className="c3-ql__bar">
                                <Bar
                                    value={
                                        line.current / Math.max(1, line.target)
                                    }
                                />
                            </span>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="c3-btn c3-btn--quiet c3-ql__more"
                        onClick={() => {
                            ctl.closePopover();
                            ctl.open('hall');
                        }}
                    >
                        <Icon name="hall" size="s" />
                        {t('hud.quest.open')}
                    </button>
                </div>
            )}
        </div>
    );
}
