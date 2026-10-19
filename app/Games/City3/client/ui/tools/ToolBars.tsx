/**
 * The bars that replace the thumb zone while a tool is on (ui-spec §5.3):
 * ✗ at the left thumb, ✓ at the right, the info between — name and
 * footprint (with a level stepper), the cost line, and one line of effect
 * or reason. Placement and move share the bar; lines add «Изгиб» and the
 * partial build; the bulldozer names what it will take and the refund.
 * The coach chip above shows for the first three uses of each tool.
 */

import type { ReactNode } from 'react';
import { useCtl, useGame, useSecond, useUi } from '../context';
import { formatExact, formatNumber } from '../format';
import { effectLine } from '../game/catalog';
import { t, word } from '../i18n';
import type { CopyKey } from '../i18n';
import { Icon } from '../icons/Icon';
import { CostLine } from '../kit/kit';
import type { Tool } from '../store/ui-store';

function Bar({
    label,
    info,
    ok,
    confirmLabel,
    confirmText,
    extra,
}: {
    label: string;
    info: ReactNode;
    ok: boolean;
    confirmLabel?: string;
    confirmText?: string;
    extra?: ReactNode;
}) {
    const ctl = useCtl();

    return (
        <div className="c3-toolbar c3-chip" role="region" aria-label={label}>
            <button
                type="button"
                className="c3-btn c3-round c3-round--cancel"
                aria-label={t('place.cancel')}
                aria-keyshortcuts="Escape"
                onClick={() => ctl.cancelTool()}
            >
                <Icon name="x" />
            </button>
            <div className="c3-toolbar__info">{info}</div>
            {extra}
            <button
                type="button"
                className={`c3-btn c3-btn--ok c3-round${confirmText ? ' c3-round--text' : ''}`}
                aria-label={confirmLabel ?? t('place.confirm')}
                aria-keyshortcuts="Enter"
                disabled={!ok}
                onClick={() => ctl.confirm()}
            >
                <Icon name="check" />
                {confirmText && <span>{confirmText}</span>}
            </button>
        </div>
    );
}

/** «‹ Изба ›» — the level stepper inside the name. */
function Stepper({
    levels,
    level,
    name,
    onLevel,
}: {
    levels: number[];
    level: number;
    name: string;
    onLevel: (level: number) => void;
}) {
    const index = levels.indexOf(level);

    if (levels.length < 2) {
        return <>{name}</>;
    }

    return (
        <span className="c3-stepper">
            <button
                type="button"
                aria-label={t('place.levelDown')}
                disabled={index <= 0}
                onClick={() => onLevel(levels[index - 1])}
            >
                <Icon name="chev-l" size="s" />
            </button>
            <span>{name}</span>
            <button
                type="button"
                aria-label={t('place.levelUp')}
                disabled={index < 0 || index >= levels.length - 1}
                onClick={() => onLevel(levels[index + 1])}
            >
                <Icon name="chev" size="s" />
            </button>
        </span>
    );
}

export function PlacementBar({
    tool,
}: {
    tool: Extract<Tool, { kind: 'place' }>;
}) {
    const ctl = useCtl();
    const game = useGame();

    useSecond();

    const info = ctl.placeInfo(tool);
    const def = info.def;
    const level = game.content.level(def, tool.level);
    const levels = game.availableLevels(def);
    const painting = tool.paint.length > 1;
    let fx: ReactNode;
    let tone = 'c3-pos';

    if (info.reason) {
        fx = info.reason;
        tone = 'c3-neg';
    } else if (painting) {
        fx =
            info.count < info.valid
                ? t('place.paintCut', { k: info.count, n: info.valid })
                : t('place.paint', {
                      n: info.count,
                      word:
                          def.category === 'housing'
                              ? word(info.count, 'homes')
                              : word(info.count, 'buildings'),
                  });
        tone = info.count < info.valid ? 'c3-neg' : 'c3-pos';
    } else if (info.short > 0) {
        fx = t('place.short', { n: formatExact(info.short) });
        tone = 'c3-neg';
    } else if (info.warn) {
        fx = info.warn;
        tone = 'c3-warn';
    } else if (info.covered > 0 && level.effects.coverage) {
        fx = t('place.coverage', {
            service: t(`service.${level.effects.coverage.service}` as CopyKey),
            n: info.covered,
            word: word(info.covered, 'homes'),
        });
    } else {
        fx = effectLine(game, def, level) || t('place.ok');
        tone = 'c3-mut';
    }

    return (
        <Bar
            label={t('place.bar')}
            ok={info.ok}
            info={
                <>
                    <div className="c3-toolbar__name">
                        <Stepper
                            levels={levels}
                            level={tool.level}
                            name={level.name}
                            onLevel={(next) => ctl.setPlaceLevel(next)}
                        />
                        <small>
                            {def.size.w}×{def.size.h}
                        </small>
                    </div>
                    <CostLine cost={info.cost} bought={!painting} />
                    <div className={`c3-toolbar__fx ${tone}`}>{fx}</div>
                </>
            }
        />
    );
}

export function MoveBar({ tool }: { tool: Extract<Tool, { kind: 'move' }> }) {
    const ctl = useCtl();
    const game = useGame();

    useSecond();

    const building = game.buildings.get(tool.uid);

    if (!building) {
        return null;
    }

    const info = ctl.moveInfo(tool);
    const def = game.def(building);

    return (
        <Bar
            label={t('place.move')}
            ok={info.ok}
            info={
                <>
                    <div className="c3-toolbar__name">
                        {t('place.move')}: {game.nameOf(building)}
                        <small>
                            {def.size.w}×{def.size.h}
                        </small>
                    </div>
                    <CostLine cost={info.cost} />
                    <div
                        className={`c3-toolbar__fx ${info.reason || info.short > 0 ? 'c3-neg' : 'c3-mut'}`}
                    >
                        {info.reason ??
                            (info.short > 0
                                ? t('place.short', {
                                      n: formatExact(info.short),
                                  })
                                : t('place.coach'))}
                    </div>
                </>
            }
        />
    );
}

export function LineBar({ tool }: { tool: Extract<Tool, { kind: 'line' }> }) {
    const ctl = useCtl();
    const game = useGame();
    const coarse = !window.matchMedia?.('(hover: hover)').matches;

    useSecond();

    const def = game.content.building(tool.type);
    const level = game.content.level(def, tool.level);
    const info = ctl.lineInfo(tool);
    const partial = info.affordable < info.buildable;
    let fx: ReactNode;
    let tone = 'c3-mut';

    if (!tool.start) {
        fx = coarse ? t('line.start') : t('line.startMouse');
    } else if (!info.buildable) {
        fx = info.reason
            ? t('line.blocked', { reason: info.reason.toLowerCase() })
            : t('line.nothing');
        tone = info.reason ? 'c3-neg' : 'c3-mut';
    } else if (partial) {
        fx = t('line.partial', { k: info.affordable, n: info.buildable });
        tone = 'c3-neg';
    } else if (info.upgrades) {
        fx = t('line.upgrade', { u: info.upgrades });
        tone = 'c3-pos';
    } else {
        fx = effectLine(game, def, level);
    }

    return (
        <Bar
            label={t('line.bar')}
            ok={info.affordable > 0}
            confirmText={
                partial && info.affordable > 0
                    ? String(info.affordable)
                    : undefined
            }
            confirmLabel={
                partial
                    ? t('line.buildN', { k: info.affordable })
                    : t('line.build')
            }
            extra={
                <button
                    type="button"
                    className={`c3-btn c3-btn--quiet c3-bend${tool.bend ? ' is-on' : ''}`}
                    aria-pressed={tool.bend === 1}
                    aria-label={t('line.bendAria')}
                    aria-keyshortcuts="Shift"
                    disabled={!tool.end}
                    onClick={() => ctl.toggleBend()}
                >
                    <Icon name="rotate" size="s" />
                    <span>{t('line.bend')}</span>
                </button>
            }
            info={
                <>
                    <div className="c3-toolbar__name">
                        <Stepper
                            levels={game.availableLevels(def)}
                            level={tool.level}
                            name={level.name}
                            onLevel={(next) => ctl.setLineLevel(next)}
                        />
                        {info.buildable > 0 && (
                            <small>
                                {t('line.cost', {
                                    n: info.buildable,
                                    word: word(info.buildable, 'tiles'),
                                })}
                            </small>
                        )}
                    </div>
                    {info.affordable > 0 ? (
                        <CostLine cost={info.cost} short={false} />
                    ) : (
                        <CostLine cost={game.buildCost(def, tool.level)} />
                    )}
                    <div className={`c3-toolbar__fx ${tone}`}>{fx}</div>
                </>
            }
        />
    );
}

export function BulldozeBar({
    tool,
}: {
    tool: Extract<Tool, { kind: 'bulldoze' }>;
}) {
    const ctl = useCtl();
    const info = ctl.bulldozeInfo(tool.picked);
    const picked = tool.picked.length > 0;
    const text = !picked
        ? t('bulldoze.hint')
        : info.roads > 1
          ? t('bulldoze.run', {
                n: info.roads,
                word: word(info.roads, 'tiles'),
                m: formatNumber(info.refund),
            })
          : t('bulldoze.one', {
                name: info.name,
                n: formatNumber(info.refund),
            });

    return (
        <div
            className="c3-toolbar c3-chip"
            role="region"
            aria-label={t('bulldoze.bar')}
        >
            <button
                type="button"
                className="c3-btn c3-round c3-round--cancel"
                aria-label={t('place.cancel')}
                aria-keyshortcuts="Escape"
                onClick={() => ctl.cancelTool()}
            >
                <Icon name="x" />
            </button>
            <div className="c3-toolbar__info c3-toolbar__info--left">
                <div className="c3-toolbar__name">
                    <Icon name="bulldoze" size="s" className="c3-neg" />
                    {t('bulldoze.bar')}
                </div>
                <div className={`c3-toolbar__fx ${picked ? '' : 'c3-mut'}`}>
                    {text}
                </div>
            </div>
            <button
                type="button"
                className="c3-btn c3-btn--danger c3-toolbar__go"
                disabled={!picked}
                aria-keyshortcuts="Enter"
                onClick={() => ctl.confirmBulldoze()}
            >
                {t('bulldoze.go')}
            </button>
        </div>
    );
}

export function CoachChip() {
    const tool = useUi((s) => s.tool);
    const coach = useUi((s) => s.coach);
    const hints = useUi((s) => s.hints);
    const coarse = !window.matchMedia?.('(hover: hover)').matches;

    if (!hints) {
        return null;
    }

    let id: string | null = null;
    let text = '';

    if (tool.kind === 'place' && tool.paint.length <= 1) {
        const paint = (coach.paint ?? 0) > 0 && (coach.paint ?? 0) <= 3;

        id = paint ? 'paint' : 'place';
        text = paint ? t('place.coachPaint') : t('place.coach');
    } else if (tool.kind === 'move') {
        id = 'place';
        text = t('place.coach');
    } else if (tool.kind === 'line' && tool.start && !tool.end && coarse) {
        id = 'line';
        text = t('line.coach');
    }

    if (!id || (coach[id] ?? 0) > 3) {
        return null;
    }

    return (
        <div className="c3-coach c3-chip" role="status">
            <Icon name={tool.kind === 'line' ? 'road' : 'move'} />
            <span>{text}</span>
        </div>
    );
}

/** The bar for the tool on, or null. */
export function ToolBar() {
    const tool = useUi((s) => s.tool);

    switch (tool.kind) {
        case 'place':
            return <PlacementBar tool={tool} />;
        case 'move':
            return <MoveBar tool={tool} />;
        case 'line':
            return <LineBar tool={tool} />;
        case 'bulldoze':
            return <BulldozeBar tool={tool} />;
        default:
            return null;
    }
}
