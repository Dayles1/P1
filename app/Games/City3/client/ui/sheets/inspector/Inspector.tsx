/**
 * The inspector (ui-spec §5.2, §6.4, gdd §11.2): thumbnail, level name,
 * «Жилой дом, уровень 3 из 11», the era tag in the level's own accent; the
 * state (строится, законсервировано, наследие, no road, short of power or
 * inputs); three fact tiles per type; for homes the next level's needs
 * with one fixing action; Upgrade at the trade-in price, Move, Mothball /
 * Open, Demolish with the refund (undo instead of a confirm); type
 * extras: the district name, the street upgrade, the Bureau's looks.
 */

import { useState } from 'react';
import type { BuildingState } from '../../../engine/sim/state';
import { useCtl, useGame, useSecond, useUi } from '../../context';
import {
    formatExact,
    formatNumber,
    formatPercent,
    formatRate,
} from '../../format';
import { fixFor } from '../../game/advisor';
import { tabOf, TABS } from '../../game/catalog';
import { streetUpgrade, upgradeStreet } from '../../game/street';
import { t, word } from '../../i18n';
import type { CopyKey } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Bar, CostLine } from '../../kit/kit';
import { Thumb } from '../build/Thumb';
import { Section, Sheet } from '../Sheet';

/** Colours the player can paint walls and roofs with (from the Bureau). */
const SWATCHES = [
    '#f2ede4',
    '#e6d3a8',
    '#d9a066',
    '#b5653a',
    '#8f3b2c',
    '#5b3b22',
    '#6d7f4f',
    '#3f6f8f',
    '#2f3a4a',
    '#9aa3ad',
    '#c94f6d',
    '#7b4fc9',
];

function Fact({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <div className="c3-fact">
            <dt>{label}</dt>
            <dd className={`c3-num${tone ? ` ${tone}` : ''}`}>{value}</dd>
        </div>
    );
}

function Facts({ building }: { building: BuildingState }) {
    const game = useGame();
    const status = game.status.get(building.uid);
    const effects = game.workEffects(building);
    const def = game.def(building);
    const role = game.roleOf(building);
    const facts: { label: CopyKey; value: string; tone?: string }[] = [];

    if (role === 'road') {
        const level = game.levelDef(building);

        facts.push(
            {
                label: 'inspector.fact.capacity',
                value: formatNumber(level.capacity ?? 0),
            },
            {
                label: 'inspector.fact.level',
                value: `${building.level} / ${def.levels.length}`,
            },
            {
                label: 'inspector.fact.upkeep',
                value: formatRate(-(level.upkeep ?? 0)),
                tone: 'c3-neg',
            },
        );
    } else if (effects.housing) {
        const population = Math.max(1, game.state.population);
        const tax = ((status?.residents ?? 0) / population) * game.stats.tax;

        facts.push(
            {
                label: 'inspector.fact.residents',
                value: `${status?.residents ?? 0} / ${effects.housing}`,
            },
            {
                label: 'inspector.fact.tax',
                value: formatRate(tax),
                tone: 'c3-pos',
            },
            {
                label: 'inspector.fact.happiness',
                value: formatPercent(
                    (status?.happiness ?? game.stats.happiness) / 100,
                ),
            },
        );
    } else {
        const output = Object.entries(status?.output ?? {})[0];

        if (output) {
            facts.push({
                label: 'inspector.fact.output',
                value: formatRate(output[1]),
                tone: 'c3-pos',
            });
        } else if (effects.coverage) {
            facts.push({
                label: 'inspector.fact.radius',
                value: String(effects.coverage.radius),
            });
        } else if (effects.storage) {
            facts.push({
                label: 'inspector.fact.storage',
                value: `+${formatNumber(effects.storage)}`,
            });
        } else if (effects.power) {
            facts.push({
                label: 'inspector.fact.power',
                value: formatNumber(effects.power * (status?.efficiency ?? 1)),
            });
        } else if (effects.trade) {
            facts.push({
                label: 'inspector.fact.trade',
                value: formatRate(effects.trade),
            });
        }

        if (effects.jobs) {
            facts.push({
                label: 'inspector.fact.workers',
                value: `${status?.workers ?? 0} / ${effects.jobs}`,
            });
        }

        if (effects.coverage && facts.length < 3) {
            let homes = 0;
            const area = {
                x: building.x,
                y: building.y,
                w: def.size.w,
                h: def.size.h,
            };

            for (const other of game.buildings.values()) {
                const size = game.def(other).size;

                if (
                    game.def(other).category === 'housing' &&
                    Math.max(
                        0,
                        area.x - (other.x + size.w - 1),
                        other.x - (area.x + area.w - 1),
                    ) +
                        Math.max(
                            0,
                            area.y - (other.y + size.h - 1),
                            other.y - (area.y + area.h - 1),
                        ) <=
                        effects.coverage.radius
                ) {
                    homes++;
                }
            }

            facts.push({ label: 'inspector.fact.homes', value: String(homes) });
        }

        facts.push({
            label: 'inspector.fact.upkeep',
            value:
                status && status.upkeep > 0 ? formatRate(-status.upkeep) : '0',
            tone: status && status.upkeep > 0 ? 'c3-neg' : undefined,
        });
    }

    return (
        <dl className="c3-facts">
            {facts.slice(0, 3).map((fact) => (
                <Fact
                    key={fact.label}
                    label={t(fact.label)}
                    value={fact.value}
                    tone={fact.tone}
                />
            ))}
        </dl>
    );
}

function Needs({ building }: { building: BuildingState }) {
    const ctl = useCtl();
    const game = useGame();
    const def = game.def(building);
    const next = def.levels[building.level];

    if (!next?.tier || !game.isComplete(building)) {
        return null;
    }

    const needs = game.content.world.population.needs.slice(0, next.tier);
    const missing = new Set(
        game.missingNeeds(
            def,
            building.level + 1,
            building.x,
            building.y,
            building.uid,
        ),
    );
    const first = needs.find((need) => missing.has(need));
    const fix = first ? fixFor(game, first) : null;
    const fixType = fix?.kind === 'build' ? fix.type : undefined;
    const fixName = fixType ? game.content.building(fixType).name : null;

    return (
        <Section title={t('inspector.needs', { next: next.name })}>
            <div className="c3-needs">
                {needs.map((need) => {
                    const miss = missing.has(need);

                    return (
                        <span
                            key={need.label}
                            className={`c3-need${miss ? ' c3-need--miss' : ' c3-need--ok'}`}
                        >
                            <Icon name={miss ? 'x' : 'check'} />
                            {need.label}
                        </span>
                    );
                })}
            </div>
            {first && (
                <>
                    <p className="c3-hint">{t('inspector.needsHint')}</p>
                    {fix && (
                        <button
                            type="button"
                            className="c3-btn c3-btn--quiet"
                            onClick={() =>
                                fixType
                                    ? ctl.placeNear(fixType, {
                                          x: building.x,
                                          y: building.y,
                                      })
                                    : ctl.openFix(fix)
                            }
                        >
                            <Icon name={fixType ? 'build' : 'chev'} size="s" />
                            {fixName
                                ? t('inspector.fix', { name: fixName })
                                : first.label}
                        </button>
                    )}
                </>
            )}
        </Section>
    );
}

function DistrictName({ building }: { building: BuildingState }) {
    const game = useGame();
    const [name, setName] = useState(building.district?.name ?? '');
    let members = 0;

    for (const status of game.status.values()) {
        members += status.district === building.uid ? 1 : 0;
    }

    return (
        <Section title={t('inspector.district')}>
            <input
                className="c3-input"
                value={name}
                maxLength={40}
                aria-label={t('inspector.district')}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => game.setDistrict(building.uid, name)}
                onKeyDown={(event) =>
                    event.key === 'Enter' &&
                    game.setDistrict(building.uid, name)
                }
            />
            <p className="c3-hint">
                {t('inspector.districtHint', {
                    n: members,
                    r: game.content.world.districts.radius,
                })}
            </p>
        </Section>
    );
}

function Looks({ building }: { building: BuildingState }) {
    const game = useGame();
    const def = game.def(building);
    const style = building.style ?? { blueprint: null, colors: {} };
    const blueprints = game.content.blueprints.filter(
        (blueprint) =>
            game.state.blueprints.includes(blueprint.id) &&
            game.blueprintFits(blueprint, def),
    );
    const apply = (next: typeof style) => game.setStyle(building.uid, next);

    return (
        <details className="c3-details">
            <summary>{t('inspector.look')}</summary>
            <label className="c3-field">
                <span>{t('inspector.blueprint')}</span>
                <select
                    className="c3-input"
                    value={style.blueprint ?? ''}
                    onChange={(event) =>
                        apply({
                            ...style,
                            blueprint: event.target.value || null,
                        })
                    }
                >
                    <option value="">{t('inspector.asBuilt')}</option>
                    {blueprints.map((blueprint) => (
                        <option key={blueprint.id} value={blueprint.id}>
                            {blueprint.name}
                        </option>
                    ))}
                </select>
            </label>
            {blueprints.length === 0 && (
                <p className="c3-hint">{t('inspector.noBlueprints')}</p>
            )}
            {(['wall', 'roof'] as const).map((key) => (
                <div key={key} className="c3-swatches">
                    <span>
                        {key === 'wall'
                            ? t('inspector.walls')
                            : t('inspector.roof')}
                    </span>
                    {SWATCHES.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-pressed={style.colors[key] === color}
                            style={{ background: color }}
                            aria-label={color}
                            onClick={() =>
                                apply({
                                    ...style,
                                    colors: { ...style.colors, [key]: color },
                                })
                            }
                        />
                    ))}
                    {style.colors[key] && (
                        <button
                            type="button"
                            className="c3-swatches__reset"
                            aria-label={t('inspector.reset')}
                            onClick={() => {
                                const colors = { ...style.colors };

                                delete colors[key];
                                apply({ ...style, colors });
                            }}
                        >
                            <Icon name="undo" size="xs" />
                        </button>
                    )}
                </div>
            ))}
        </details>
    );
}

function States({ building }: { building: BuildingState }) {
    const game = useGame();
    const status = game.status.get(building.uid);
    const def = game.def(building);
    const lines: { tone: 'bad' | 'warn' | 'info'; text: string }[] = [];

    if (building.mothballed) {
        lines.push({ tone: 'warn', text: t('inspector.mothballed') });
    } else if (status?.level) {
        if (!status.connected) {
            lines.push({ tone: 'bad', text: t('inspector.noRoad') });
        }

        if (status.noPower) {
            lines.push({ tone: 'bad', text: t('inspector.noPower') });
        }

        if (status.starved) {
            lines.push({
                tone: 'bad',
                text: t('inspector.starved', {
                    res: (
                        game.content.resource(status.starved)?.name ??
                        status.starved
                    ).toLowerCase(),
                }),
            });
        }

        const staff = def.jobClass ? game.stats.staff[def.jobClass] : 1;

        if (game.workEffects(building).jobs && staff < 1) {
            lines.push({
                tone: 'warn',
                text: t('inspector.staff', { pct: Math.round(staff * 100) }),
            });
        }
    }

    if (!game.isComplete(building)) {
        const spy = game.clock.secondsPerYear;
        const left = Math.max(0, building.buildEnd - game.state.time);
        const share =
            (game.state.time - building.buildStart) /
            Math.max(1, building.buildEnd - building.buildStart);

        return (
            <div className="c3-banner c3-banner--info">
                <span>
                    {t('inspector.building', {
                        t:
                            left >= spy
                                ? `${Math.ceil(left / spy)} ${word(Math.ceil(left / spy), 'years')}`
                                : `${Math.ceil(left)} с`,
                    })}
                    {status?.level
                        ? `. ${t('inspector.buildingOld', { name: game.content.level(def, status.level).name })}`
                        : ''}
                </span>
                <Bar value={share} />
                {lines.map((line) => (
                    <span
                        key={line.text}
                        className={`c3-${line.tone === 'bad' ? 'neg' : 'warn'}`}
                    >
                        {line.text}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <>
            {lines.map((line) => (
                <div
                    key={line.text}
                    className={`c3-banner c3-banner--${line.tone}`}
                >
                    <Icon
                        name={line.tone === 'bad' ? 'alert' : 'info'}
                        size="s"
                    />
                    {line.text}
                </div>
            ))}
        </>
    );
}

function Actions({ building }: { building: BuildingState }) {
    const ctl = useCtl();
    const game = useGame();
    const def = game.def(building);
    const role = game.roleOf(building);
    const next = def.levels[building.level];
    const block = game.upgradeBlock(building);
    const cost = game.upgradeCost(building);
    const affordable = game.canAfford(cost);
    const moveBlock = role === 'road' ? 'road' : game.moveBlock(building);
    const mothballBlock = game.mothballBlock(building);
    const street = role === 'road' ? streetUpgrade(game, building) : null;

    return (
        <Section>
            {street && street.tiles.length > 1 && (
                <button
                    type="button"
                    className="c3-btn c3-btn--primary c3-btn--wide"
                    disabled={!game.canAfford(street.cost)}
                    onClick={() => upgradeStreet(game, building)}
                >
                    <Icon name="upgrade" size="s" />
                    {t('inspector.street', {
                        n: street.tiles.length,
                        word: word(street.tiles.length, 'tiles'),
                    })}
                    <CostLine cost={street.cost} />
                </button>
            )}
            {next && (
                <>
                    <button
                        type="button"
                        className="c3-btn c3-btn--primary c3-btn--wide"
                        disabled={Boolean(block) || !affordable}
                        onClick={() => game.upgrade(building.uid)}
                    >
                        <Icon name="upgrade" size="s" />
                        {t('inspector.upgradeTo', { name: next.name })}
                        {!block && <CostLine cost={cost} />}
                    </button>
                    {block ? (
                        <p className="c3-why">{block}</p>
                    ) : (
                        <button
                            type="button"
                            className="c3-link c3-link--center"
                            onClick={() =>
                                ctl.open('price', {
                                    price: {
                                        uid: building.uid,
                                        level: building.level + 1,
                                    },
                                    selection: building.uid,
                                })
                            }
                        >
                            {t('inspector.price')}
                        </button>
                    )}
                </>
            )}
            <div className="c3-act-row">
                {!moveBlock && (
                    <button
                        type="button"
                        className="c3-btn"
                        onClick={() => ctl.startMove(building.uid)}
                    >
                        <Icon name="move" size="s" />
                        {t('inspector.move')}
                    </button>
                )}
                {building.mothballed ? (
                    <button
                        type="button"
                        className="c3-btn c3-btn--primary"
                        title={formatRate(-game.workDef(building).upkeep)}
                        onClick={() => game.reopen(building.uid)}
                    >
                        <Icon name="unlock" size="s" />
                        {t('inspector.reopen')}
                    </button>
                ) : (
                    !mothballBlock && (
                        <button
                            type="button"
                            className="c3-btn"
                            onClick={() => game.mothball(building.uid)}
                        >
                            <Icon name="lock" size="s" />
                            {t('inspector.mothball')}
                        </button>
                    )
                )}
                <button
                    type="button"
                    className="c3-btn c3-btn--danger"
                    onClick={() => ctl.demolishNow([building.uid])}
                >
                    <Icon name="bulldoze" size="s" />
                    {t('inspector.demolish')}
                </button>
            </div>
            <p className="c3-hint c3-hint--center">
                {t('inspector.refund', {
                    n: formatExact(game.refund(building)),
                })}
            </p>
        </Section>
    );
}

export function Inspector() {
    const ctl = useCtl();
    const game = useGame();
    const uid = useUi((s) => s.selection);
    const stack = useUi((s) => s.stack);

    useSecond();

    const building = uid !== null ? game.buildings.get(uid) : undefined;

    if (!building) {
        return null;
    }

    const def = game.def(building);
    const level = game.levelDef(building);
    const era = game.content.epochById(level.epoch);
    const role = game.roleOf(building);
    const heritage = game.heritageMult(building);
    const tab = tabOf(game, def);
    const icon = TABS.find((item) => item.id === tab)?.icon ?? 'house';

    return (
        <Sheet
            title={game.nameOf(building)}
            sub={t('inspector.level', {
                family: def.name,
                l: building.level,
                max: def.levels.length,
            })}
            thumb={
                <Thumb
                    key={`${def.id}:${building.level}`}
                    def={def}
                    level={building.level}
                    size={64}
                    fallback={icon}
                    className="c3-ph-thumb"
                />
            }
        >
            <div className="c3-tags">
                <span
                    className="c3-era-tag"
                    style={{ ['--tag' as string]: era.accent }}
                >
                    <i />
                    {era.name}
                </span>
                {heritage > 1 && (
                    <span className="c3-era-tag c3-era-tag--heritage">
                        {t('inspector.heritage', {
                            n: String(heritage).replace('.', ','),
                        })}
                    </span>
                )}
            </div>
            {stack > 0 && (
                <button
                    type="button"
                    className="c3-link"
                    onClick={() => ctl.selectNext()}
                >
                    {t('inspector.others', { n: stack })}
                </button>
            )}
            <States building={building} />
            <Facts building={building} />
            <Needs building={building} />
            {role === 'district' && (
                <DistrictName key={building.uid} building={building} />
            )}
            <div className="c3-rule" />
            <Actions building={building} />
            {game.bureau && !role && <Looks building={building} />}
        </Sheet>
    );
}
