import { useMemo, useState } from 'react';
import type { BuildingDef, Category, Effects } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { renderThumbnail } from '../scene/thumbnails';
import { CATEGORY_NAMES, CostLine } from './common';

/** A picture of a building level, or its icon when 3D is unavailable. */
export function Thumb({
    game,
    def,
    level,
    size = 96,
}: {
    game: Game;
    def: BuildingDef;
    level: number;
    size?: number;
}) {
    const src = useMemo(() => {
        try {
            return renderThumbnail(game.content, def, level, size * 2);
        } catch {
            return null;
        }
    }, [game.content, def, level, size]);

    return src ? (
        <img
            className="thumb"
            src={src}
            alt=""
            width={size}
            height={size}
            draggable={false}
        />
    ) : (
        <span
            className="thumb thumb--icon"
            style={{ width: size, height: size }}
        >
            {def.icon}
        </span>
    );
}

function tags(game: Game, def: BuildingDef, effects: Effects): string[] {
    const list = [`${def.size.w}×${def.size.h}`];

    if (effects.housing) {
        list.push(`👥 ${effects.housing}`);
    }

    if (effects.jobs) {
        list.push(`👷 ${effects.jobs}`);
    }

    for (const id of Object.keys(effects.produces)) {
        list.push(`+${game.content.resource(id)?.icon ?? id}`);
    }

    if (effects.power) {
        list.push(`⚡ +${effects.power}`);
    }

    if (effects.aura) {
        list.push(`😊 +${effects.aura.happiness}`);
    }

    if (effects.storage) {
        list.push(`📦 +${effects.storage}`);
    }

    return list;
}

/**
 * The construction dock along the bottom: categories, every building with
 * a picture, and a level picker — any level already open can be built
 * straight away. It stays open while you build.
 */
export function BuildDock({
    game,
    active,
    levels,
    onLevel,
    onPick,
    onCollapse,
}: {
    game: Game;
    active: { type: string; level: number } | null;
    /** The level chosen per building (defaults to the highest open one). */
    levels: Record<string, number>;
    onLevel: (type: string, level: number) => void;
    onPick: (type: string, level: number) => void;
    onCollapse: () => void;
}) {
    const [category, setCategory] = useState<Category | 'all'>('housing');
    const [query, setQuery] = useState('');
    const epoch = game.state.epoch;
    const shown = game.content.buildings.filter(
        (def) => !def.hidden && game.content.firstEpoch(def) <= epoch + 1,
    );
    const search = query.trim().toLowerCase();
    const items = shown.filter((def) =>
        search
            ? def.name.toLowerCase().includes(search) ||
              def.levels.some((level) =>
                  level.name.toLowerCase().includes(search),
              )
            : category === 'all' || def.category === category,
    );
    const categories = (Object.keys(CATEGORY_NAMES) as Category[]).filter(
        (id) => shown.some((def) => def.category === id),
    );

    return (
        <section className="dock" aria-label="Строительство">
            <div className="dock__tabs" role="tablist">
                {categories.map((id) => {
                    const open = shown.filter(
                        (def) => def.category === id && !game.lockReason(def),
                    ).length;

                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={!search && category === id}
                            onClick={() => {
                                setCategory(id);
                                setQuery('');
                            }}
                            title={CATEGORY_NAMES[id].name}
                        >
                            <span>{CATEGORY_NAMES[id].icon}</span>
                            {CATEGORY_NAMES[id].name}
                            {open > 0 && <em>{open}</em>}
                        </button>
                    );
                })}
                <input
                    className="dock__search"
                    type="search"
                    placeholder="🔎 Найти здание"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <button
                    type="button"
                    className="dock__collapse"
                    onClick={onCollapse}
                    title="Свернуть (B)"
                >
                    ▾
                </button>
            </div>

            <div className="dock__list">
                {items.map((def) => {
                    const available = game.availableLevels(def);
                    const locked = game.lockReason(def);
                    const chosen =
                        levels[def.id] && available.includes(levels[def.id])
                            ? levels[def.id]
                            : (available.at(-1) ?? 1);
                    const level = game.content.level(def, chosen);
                    const cost = game.buildCost(def, chosen);
                    const position = available.indexOf(chosen);
                    const isActive =
                        active?.type === def.id && active.level === chosen;
                    const step = (delta: number) => {
                        const next = available[position + delta];

                        if (next) {
                            onLevel(def.id, next);

                            if (active?.type === def.id) {
                                onPick(def.id, next);
                            }
                        }
                    };

                    return (
                        <article
                            key={def.id}
                            className={`dock-card${locked ? ' dock-card--locked' : ''}${isActive ? ' dock-card--active' : ''}${!locked && !game.canAfford(cost) ? ' dock-card--poor' : ''}`}
                        >
                            <button
                                type="button"
                                className="dock-card__pick"
                                disabled={Boolean(locked)}
                                onClick={() => onPick(def.id, chosen)}
                                title={level.description ?? def.description}
                            >
                                <Thumb game={game} def={def} level={chosen} />
                                <span className="dock-card__name">
                                    {locked ? '🔒 ' : ''}
                                    {level.name}
                                </span>
                                {level.name !== def.name && (
                                    <span className="dock-card__family">
                                        {def.icon} {def.name}
                                    </span>
                                )}
                                {locked ? (
                                    <span className="dock-card__lock">
                                        {locked}
                                    </span>
                                ) : (
                                    <CostLine game={game} cost={cost} />
                                )}
                                <span className="dock-card__tags">
                                    {tags(game, def, level.effects).map(
                                        (tag) => (
                                            <em key={tag}>{tag}</em>
                                        ),
                                    )}
                                </span>
                            </button>
                            {available.length > 1 && (
                                <div
                                    className="dock-card__levels"
                                    title={def.levels
                                        .map(
                                            (l) =>
                                                `${l.level}. ${l.name} — ${game.content.epochById(l.epoch).year} г.${game.levelLock(def, l.level) ? ' 🔒' : ''}`,
                                        )
                                        .join('\n')}
                                >
                                    <button
                                        type="button"
                                        disabled={position <= 0}
                                        onClick={() => step(-1)}
                                        aria-label="Уровень ниже"
                                    >
                                        ‹
                                    </button>
                                    <span>
                                        ур. {chosen}
                                        <small>/{def.levels.length}</small>
                                    </span>
                                    <button
                                        type="button"
                                        disabled={
                                            position >= available.length - 1
                                        }
                                        onClick={() => step(1)}
                                        aria-label="Уровень выше"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </article>
                    );
                })}
                {items.length === 0 && (
                    <p className="dock__empty">Здесь пока ничего нет.</p>
                )}
            </div>
        </section>
    );
}
