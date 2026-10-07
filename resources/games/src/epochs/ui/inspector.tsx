import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Effects } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import type { BuildingState, NpcState } from '../engine/sim/state';
import { Thumb } from './build';
import { CostLine, face, perMinute } from './common';

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

export function effectLines(game: Game, effects: Effects): string[] {
    const lines: string[] = [];
    const res = (id: string) => game.content.resource(id);

    for (const [id, v] of Object.entries(effects.produces)) {
        lines.push(`${res(id)?.icon} ${res(id)?.name}: ${perMinute(v)}`);
    }

    for (const [id, v] of Object.entries(effects.consumes)) {
        lines.push(
            `${res(id)?.icon} тратит ${res(id)?.name.toLowerCase()}: ${perMinute(v).slice(1)}`,
        );
    }

    if (effects.housing) {
        lines.push(`👥 жильё на ${effects.housing}`);
    }

    if (effects.jobs) {
        lines.push(`👷 рабочих мест ${effects.jobs}`);
    }

    if (effects.storage) {
        lines.push(`📦 склад +${effects.storage}`);
    }

    if (effects.power) {
        lines.push(`⚡ энергия +${effects.power}`);
    }

    if (effects.powerUse) {
        lines.push(`🔌 потребляет энергии ${effects.powerUse}`);
    }

    if (effects.aura) {
        lines.push(
            `😊 радость +${effects.aura.happiness} в радиусе ${effects.aura.radius}`,
        );
    }

    if (effects.pollution) {
        lines.push(
            `🏭 загрязнение −${effects.pollution.amount} в радиусе ${effects.pollution.radius}`,
        );
    }

    if (effects.boost) {
        lines.push(
            `⬆ +${effects.boost.percent}% зданиям: ${effects.boost.targets.map((t) => (game.content.hasBuilding(t) ? game.content.building(t).name : t)).join(', ')}`,
        );
    }

    if (effects.near) {
        lines.push(
            `🌲 +${Math.round(effects.near.perTile * 600) / 10}/мин за каждый объект «${effects.near.feature}» рядом`,
        );
    }

    if (effects.seasonal) {
        lines.push('🌦️ зависит от сезона и плодородия');
    }

    return lines;
}

/** Every level of a building's line as a row of steps across the eras. */
function LevelPath({
    game,
    building,
}: {
    game: Game;
    building: BuildingState;
}) {
    const def = game.def(building);

    return (
        <ol className="level-path">
            {def.levels.map((level) => {
                const locked = game.levelLock(def, level.level);
                const state =
                    level.level < building.level
                        ? 'past'
                        : level.level === building.level
                          ? 'now'
                          : locked
                            ? 'locked'
                            : 'open';

                return (
                    <li
                        key={level.level}
                        className={`level-path__step level-path__step--${state}`}
                        title={`${level.level}. ${level.name} · ${game.content.epochById(level.epoch).name}${locked && state === 'locked' ? `\n🔒 ${locked}` : ''}`}
                    >
                        {level.level}
                    </li>
                );
            })}
        </ol>
    );
}

function StyleSection({
    game,
    building,
}: {
    game: Game;
    building: BuildingState;
}) {
    const def = game.def(building);
    const style = building.style ?? { blueprint: null, colors: {} };
    const blueprints = game.content.blueprints.filter(
        (blueprint) =>
            game.state.blueprints.includes(blueprint.id) &&
            game.blueprintFits(blueprint, def),
    );
    const apply = (next: typeof style) => game.setStyle(building.uid, next);

    return (
        <details className="inspector__section">
            <summary>🎨 Облик здания</summary>
            <label className="field">
                <span>Чертёж</span>
                <select
                    value={style.blueprint ?? ''}
                    onChange={(event) =>
                        apply({
                            ...style,
                            blueprint: event.target.value || null,
                        })
                    }
                >
                    <option value="">Как построено</option>
                    {blueprints.map((blueprint) => (
                        <option key={blueprint.id} value={blueprint.id}>
                            {blueprint.icon} {blueprint.name}
                        </option>
                    ))}
                </select>
            </label>
            {blueprints.length === 0 && (
                <p className="inspector__hint">
                    Чертежи открываются в бюро архитекторов.
                </p>
            )}
            {(['wall', 'roof'] as const).map((key) => (
                <div key={key} className="swatches">
                    <span>{key === 'wall' ? 'Стены' : 'Крыша'}</span>
                    {SWATCHES.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-pressed={style.colors[key] === color}
                            style={{ background: color }}
                            onClick={() =>
                                apply({
                                    ...style,
                                    colors: { ...style.colors, [key]: color },
                                })
                            }
                            aria-label={color}
                        />
                    ))}
                    {style.colors[key] && (
                        <button
                            type="button"
                            className="swatches__reset"
                            onClick={() => {
                                const colors = { ...style.colors };

                                delete colors[key];
                                apply({ ...style, colors });
                            }}
                            title="Как было"
                        >
                            ↺
                        </button>
                    )}
                </div>
            ))}
        </details>
    );
}

function DistrictSection({
    game,
    building,
}: {
    game: Game;
    building: BuildingState;
}) {
    const [name, setName] = useState(building.district?.name ?? '');
    const policies = game.content.world.districts.policies;
    const current = building.district?.policy ?? null;
    let members = 0;

    for (const status of game.status.values()) {
        members += status.district === building.uid ? 1 : 0;
    }

    return (
        <div className="inspector__section inspector__section--open">
            <b>🏛️ Округ</b>
            <label className="field">
                <span>Название</span>
                <input
                    value={name}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => game.setDistrict(building.uid, name, current)}
                    onKeyDown={(event) =>
                        event.key === 'Enter' &&
                        game.setDistrict(building.uid, name, current)
                    }
                />
            </label>
            <p className="inspector__hint">
                Зданий в округе: {members} · радиус{' '}
                {game.content.world.districts.radius} клеток. Дороги от управы
                работают без связи с центром.
            </p>
            <div className="policies">
                {[null, ...policies].map((policy) => (
                    <button
                        key={policy?.id ?? 'none'}
                        type="button"
                        aria-pressed={current === (policy?.id ?? null)}
                        onClick={() =>
                            game.setDistrict(
                                building.uid,
                                name,
                                policy?.id ?? null,
                            )
                        }
                        title={policy?.description ?? 'Без особой политики'}
                    >
                        <span>{policy?.icon ?? '—'}</span>
                        {policy?.name ?? 'Обычный'}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function Inspector({
    game,
    building,
    others,
    onUpgrade,
    onUpgradeAll,
    onMove,
    onDemolish,
    onClose,
    onNext,
}: {
    game: Game;
    building: BuildingState;
    /** How many more buildings were under the cursor (click again to switch). */
    others: number;
    onUpgrade: () => void;
    onUpgradeAll: () => void;
    onMove: () => void;
    onDemolish: () => void;
    onClose: () => void;
    onNext: () => void;
}) {
    const def = game.def(building);
    const level = game.levelDef(building);
    const status = game.status.get(building.uid);
    const block = game.upgradeBlock(building);
    const next = def.levels[building.level];
    const fixed = def.role === 'center';
    const problems: string[] = [];
    let same = 0;

    for (const other of game.buildings.values()) {
        same +=
            other.type === building.type && other.level === building.level
                ? 1
                : 0;
    }

    if (status?.complete) {
        if (!status.connected) {
            problems.push('🚧 Нет дороги до центра или управы — не работает.');
        }

        if (status.noPower) {
            problems.push('⚡ Не хватает энергии.');
        }

        if (status.starved) {
            problems.push(
                `📦 Не хватает: ${game.content.resource(status.starved)?.name.toLowerCase()}.`,
            );
        }

        if (game.effects(building).jobs && game.stats.employment < 1) {
            problems.push(
                `👷 Рабочих хватает на ${Math.round(game.stats.employment * 100)}% — нужно больше жилья.`,
            );
        }
    }

    const live: ReactNode[] = [];

    for (const [id, rate] of Object.entries(status?.output ?? {})) {
        live.push(
            <li key={`o${id}`}>
                {game.content.resource(id)?.icon}{' '}
                {game.content.resource(id)?.name}: <b>{perMinute(rate)}</b>
            </li>,
        );
    }

    for (const [id, rate] of Object.entries(status?.input ?? {})) {
        live.push(
            <li key={`i${id}`}>
                {game.content.resource(id)?.icon} тратит:{' '}
                <b>{perMinute(-rate)}</b>
            </li>,
        );
    }

    if (status && game.effects(building).housing && !fixed) {
        live.push(
            <li key="res">
                👥 Жильцы: <b>{status.residents}</b>
            </li>,
        );
    }

    if (status?.happiness !== null && status?.happiness !== undefined) {
        live.push(
            <li key="hap">
                {face(status.happiness)} Уют района:{' '}
                <b>{Math.round(status.happiness)}</b>
            </li>,
        );
    }

    if (status && game.effects(building).jobs) {
        live.push(
            <li key="job">
                👷 Работают: <b>{status.workers}</b> /{' '}
                {game.effects(building).jobs}
            </li>,
        );
    }

    if (status?.nearbyFeatures) {
        live.push(
            <li key="near">
                🌲 Ресурсы рядом: <b>{status.nearbyFeatures}</b>
            </li>,
        );
    }

    if (status && status.boost > 0) {
        live.push(
            <li key="boost">
                ⬆ Бонус соседей: <b>+{Math.round(status.boost * 100)}%</b>
            </li>,
        );
    }

    if (status?.district && def.role !== 'district') {
        const hall = game.buildings.get(status.district);
        const policy = game.policyOf(hall);

        live.push(
            <li key="district">
                🏛️ Округ: <b>{hall?.district?.name}</b>
                {policy ? ` · ${policy.icon} ${policy.name}` : ''}
            </li>,
        );
    }

    const age = game.state.epoch - game.levelEpoch(building);
    const residents = game.npcs.residents.filter(
        (npc) => npc.homeUid === building.uid || npc.workUid === building.uid,
    );

    return (
        <aside className="inspector">
            <header className="inspector__head">
                <span className="inspector__icon">{def.icon}</span>
                <div>
                    <h2>{game.nameOf(building)}</h2>
                    <span className="inspector__level">
                        {def.role === 'district' ? `${level.name} · ` : ''}
                        ур. {building.level} из {def.levels.length} ·{' '}
                        {game.content.epochById(level.epoch).name}
                        {age > 0 ? ' · 🏛️ историческое' : ''}
                    </span>
                </div>
                <button
                    type="button"
                    className="inspector__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </header>

            {others > 0 && (
                <button
                    type="button"
                    className="inspector__others"
                    onClick={onNext}
                >
                    ⧉ Здесь ещё {others} — выбрать следующее (клик ещё раз)
                </button>
            )}

            <LevelPath game={game} building={building} />

            <p className="inspector__desc">
                {level.description ?? def.description}
            </p>

            {!game.isComplete(building) && (
                <p className="inspector__note">🏗️ Идёт строительство…</p>
            )}

            {problems.map((problem) => (
                <p key={problem} className="inspector__problem">
                    {problem}
                </p>
            ))}

            {live.length > 0 && <ul className="inspector__stats">{live}</ul>}

            {residents.length > 0 && (
                <p className="inspector__people">
                    {residents
                        .slice(0, 6)
                        .map((npc) => npc.name.split(' ')[0])
                        .join(', ')}
                    {residents.length > 6
                        ? ` и ещё ${residents.length - 6}`
                        : ''}
                </p>
            )}

            {def.role === 'district' && (
                <DistrictSection
                    key={building.uid}
                    game={game}
                    building={building}
                />
            )}

            {next && (
                <div className="inspector__next">
                    <Thumb game={game} def={def} level={next.level} size={64} />
                    <div>
                        <b>
                            → {next.name}{' '}
                            <small>
                                ({game.content.epochById(next.epoch).name})
                            </small>
                        </b>
                        <ul>
                            {effectLines(game, next.effects).map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="inspector__actions">
                {next && (
                    <button
                        type="button"
                        className="hud-button hud-button--primary"
                        disabled={
                            Boolean(block) ||
                            !game.canAfford(game.upgradeCost(building))
                        }
                        onClick={onUpgrade}
                    >
                        ⬆ Улучшить{' '}
                        {!block && (
                            <CostLine
                                game={game}
                                cost={game.upgradeCost(building)}
                            />
                        )}
                    </button>
                )}
                {block && next && (
                    <span className="inspector__hint">{block}</span>
                )}
                {next && !block && same > 1 && (
                    <button
                        type="button"
                        className="hud-button"
                        onClick={onUpgradeAll}
                        title="Улучшить все такие здания этого уровня, пока хватает ресурсов"
                    >
                        ⏫ Улучшить все такие ({same})
                    </button>
                )}
                {!fixed && (
                    <div className="inspector__row">
                        {def.role !== 'road' && (
                            <button
                                type="button"
                                className="hud-button"
                                onClick={onMove}
                            >
                                ↔ Перенести
                            </button>
                        )}
                        <button
                            type="button"
                            className="hud-button hud-button--danger"
                            onClick={onDemolish}
                        >
                            🧨 Снести
                        </button>
                    </div>
                )}
            </div>

            {game.bureau && !def.role && (
                <StyleSection game={game} building={building} />
            )}
        </aside>
    );
}

const ACTIVITY: Record<NpcState['activity'], string> = {
    home: '🏠 дома',
    walking: '🚶 в пути',
    working: '🔨 на работе',
    leisure: '🌳 отдыхает',
};

export function NpcPanel({
    game,
    npc,
    following,
    onFollow,
    onClose,
}: {
    game: Game;
    npc: NpcState;
    following: boolean;
    onFollow: () => void;
    onClose: () => void;
}) {
    const type = game.npcs.typeOf(npc);
    const home = game.buildings.get(npc.homeUid);
    const work = npc.workUid ? game.buildings.get(npc.workUid) : undefined;
    const mood = game.npcs.mood(npc);

    return (
        <aside className="inspector npc-panel">
            <header className="inspector__head">
                <span className="inspector__icon">{face(mood)}</span>
                <div>
                    <h2>{npc.name}</h2>
                    <span className="inspector__level">
                        {type.name} · {npc.age} лет
                    </span>
                </div>
                <button
                    type="button"
                    className="inspector__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </header>

            <blockquote className="npc-panel__thought">
                «{game.npcs.thought(npc)}»
            </blockquote>

            <ul className="inspector__stats">
                <li>
                    Сейчас: <b>{ACTIVITY[npc.activity]}</b>
                </li>
                <li>
                    Дом:{' '}
                    <b>
                        {home
                            ? `${game.def(home).icon} ${game.nameOf(home)}`
                            : '—'}
                    </b>
                </li>
                <li>
                    Работа:{' '}
                    <b>
                        {work
                            ? `${game.def(work).icon} ${game.nameOf(work)}`
                            : 'нет работы'}
                    </b>
                </li>
                <li>
                    Настроение: <b>{mood}</b>
                </li>
            </ul>

            <button
                type="button"
                className={`hud-button${following ? ' hud-button--primary' : ''}`}
                onClick={onFollow}
            >
                🎥 {following ? 'Перестать следить' : 'Следить камерой'}
            </button>
        </aside>
    );
}
