import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    BUILDINGS,
    CATEGORIES,
    EPOCHS,
    GOALS,
    RESOURCES,
    TECHS,
    buildingName,
} from '../engine/data';
import type { Category, Cost } from '../engine/data';
import { levelHousing, levelOutput, levelWorkers } from '../engine/sim';
import type { Building, City } from '../engine/sim';
import { compact, costEntries, happinessFace, perMinute } from './format';

export function CostLine({ city, cost }: { city: City; cost: Cost }) {
    return (
        <span className="cost">
            {costEntries(cost).map((entry) => (
                <span
                    key={entry.id}
                    className={
                        city.state.res[entry.id] >= entry.amount
                            ? 'cost__item'
                            : 'cost__item cost__item--short'
                    }
                >
                    {entry.icon} {compact(entry.amount)}
                </span>
            ))}
        </span>
    );
}

// ——————————————————————————————————————————————— Top bar

export function TopBar({
    city,
    speed,
    onSpeed,
    saveLabel,
    onBack,
    onMenu,
}: {
    city: City;
    speed: number;
    onSpeed: (speed: number) => void;
    saveLabel: string;
    onBack: () => void;
    onMenu: () => void;
}) {
    const epoch = EPOCHS[city.state.epoch];
    const showPower = city.state.epoch >= 7 || city.powerDemand > 0;
    const showDefense = city.state.epoch >= 1 && city.state.epoch <= 5;

    return (
        <header className="hud-top">
            <div className="hud-top__left">
                <button
                    type="button"
                    className="hud-icon"
                    onClick={onBack}
                    title="К списку игр"
                >
                    ←
                </button>
                <div className="hud-year" title={epoch.tagline}>
                    <strong>{Math.floor(city.state.year)} г.</strong>
                    <span>{epoch.name}</span>
                </div>
            </div>

            <div className="hud-res">
                {RESOURCES.map((resource) => {
                    const value = city.state.res[resource.id];
                    const rate = city.rates[resource.id];
                    const cap = city.caps[resource.id];
                    const full = resource.capped && value >= cap - 0.5;

                    return (
                        <div
                            key={resource.id}
                            className={`hud-res__item${full ? ' hud-res__item--full' : ''}`}
                            title={`${resource.name}${resource.capped ? ` · склад ${compact(cap)}` : ''}`}
                        >
                            <span className="hud-res__icon">
                                {resource.icon}
                            </span>
                            <span className="hud-res__value">
                                {compact(value)}
                                {resource.capped && (
                                    <small>/{compact(cap)}</small>
                                )}
                            </span>
                            <span
                                className={`hud-res__rate${rate < -0.001 ? ' hud-res__rate--down' : ''}`}
                            >
                                {perMinute(rate)}
                            </span>
                        </div>
                    );
                })}

                <div
                    className="hud-res__item"
                    title={`Работают ${Math.floor(Math.min(city.workers, city.jobs))} из ${Math.floor(city.workers)} · мест работы ${Math.floor(city.jobs)}`}
                >
                    <span className="hud-res__icon">👥</span>
                    <span className="hud-res__value">
                        {Math.floor(city.state.population)}
                        <small>/{Math.floor(city.housingCapacity)}</small>
                    </span>
                    <span className="hud-res__rate">
                        {city.employment < 1
                            ? `рабочих ${Math.round(city.employment * 100)}%`
                            : 'жители'}
                    </span>
                </div>

                <div
                    className="hud-res__item"
                    title="Счастье жителей: еда, работа, услуги рядом с домом, отсутствие дыма"
                >
                    <span className="hud-res__icon">
                        {happinessFace(city.happiness)}
                    </span>
                    <span className="hud-res__value">
                        {Math.round(city.happiness)}
                    </span>
                    <span
                        className={`hud-res__rate${city.happiness < 40 ? ' hud-res__rate--down' : ''}`}
                    >
                        {city.starving ? 'голод!' : 'счастье'}
                    </span>
                </div>

                {showPower && (
                    <div
                        className="hud-res__item"
                        title="Энергия: выработка / потребление"
                    >
                        <span className="hud-res__icon">⚡</span>
                        <span className="hud-res__value">
                            {Math.floor(city.powerSupply)}
                            <small>/{Math.floor(city.powerDemand)}</small>
                        </span>
                        <span
                            className={`hud-res__rate${city.powerSupply < city.powerDemand ? ' hud-res__rate--down' : ''}`}
                        >
                            энергия
                        </span>
                    </div>
                )}

                {showDefense && (
                    <div className="hud-res__item" title="Защита от набегов">
                        <span className="hud-res__icon">🛡️</span>
                        <span className="hud-res__value">
                            {Math.floor(city.defense)}
                        </span>
                        <span className="hud-res__rate">защита</span>
                    </div>
                )}
            </div>

            <div className="hud-top__right">
                <div className="hud-speed" role="group" aria-label="Скорость">
                    {[
                        [0, '⏸'],
                        [1, '▶'],
                        [2, '⏩'],
                        [4, '⏭'],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={speed === value}
                            onClick={() => onSpeed(value as number)}
                            title={
                                value ? `Скорость ×${value}` : 'Пауза (пробел)'
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <span className="hud-save">{saveLabel}</span>
                <button
                    type="button"
                    className="hud-icon"
                    onClick={onMenu}
                    title="Меню"
                >
                    ☰
                </button>
            </div>
        </header>
    );
}

// ——————————————————————————————————————————————— Build menu

export function BuildMenu({
    city,
    active,
    onPick,
    onClose,
}: {
    city: City;
    active: string | null;
    onPick: (type: string) => void;
    onClose: () => void;
}) {
    const [category, setCategory] = useState<Category>('housing');
    const epoch = city.state.epoch;
    const items = BUILDINGS.filter(
        (def) =>
            def.category === category && !def.hidden && def.epoch <= epoch + 1,
    );

    return (
        <section className="build-menu" aria-label="Строительство">
            <div className="build-menu__tabs" role="tablist">
                {CATEGORIES.map((item) => {
                    const available = BUILDINGS.some(
                        (def) =>
                            def.category === item.id &&
                            !def.hidden &&
                            !city.lockReason(def),
                    );

                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={category === item.id}
                            className={
                                available ? '' : 'build-menu__tab--empty'
                            }
                            onClick={() => setCategory(item.id)}
                        >
                            <span>{item.icon}</span> {item.name}
                        </button>
                    );
                })}
                <button
                    type="button"
                    className="build-menu__close"
                    onClick={onClose}
                    title="Закрыть (Esc)"
                >
                    ✕
                </button>
            </div>

            <div className="build-menu__list">
                {items.map((def) => {
                    const locked = city.lockReason(def);
                    const cost = city.buildCost(def);
                    const affordable = city.canAfford(cost);

                    return (
                        <button
                            key={def.id}
                            type="button"
                            className={`build-card${locked ? ' build-card--locked' : ''}${active === def.id ? ' build-card--active' : ''}${!locked && !affordable ? ' build-card--poor' : ''}`}
                            disabled={Boolean(locked)}
                            onClick={() => onPick(def.id)}
                            title={def.description}
                        >
                            <span className="build-card__icon">
                                {locked ? '🔒' : def.icon}
                            </span>
                            <span className="build-card__name">
                                {buildingName(def, epoch)}
                            </span>
                            <span className="build-card__desc">
                                {locked ?? def.description}
                            </span>
                            {!locked && <CostLine city={city} cost={cost} />}
                            <span className="build-card__tags">
                                {def.size === 2 && <em>2×2</em>}
                                {def.housing && <em>👥 {def.housing}</em>}
                                {def.workers && <em>👷 {def.workers}</em>}
                                {def.aura && <em>😊 +{def.aura.happiness}</em>}
                            </span>
                        </button>
                    );
                })}
                {items.length === 0 && (
                    <p className="build-menu__empty">
                        В этой эпохе здесь пока ничего нет.
                    </p>
                )}
            </div>
        </section>
    );
}

// ——————————————————————————————————————————————— Selected building

export function Inspector({
    city,
    building,
    onUpgrade,
    onMove,
    onDemolish,
    onClose,
}: {
    city: City;
    building: Building;
    onUpgrade: () => void;
    onMove: () => void;
    onDemolish: () => void;
    onClose: () => void;
}) {
    const def = city.def(building);
    const status = city.status.get(building.id);
    const block = city.upgradeBlock(building);
    const upgradeCost = city.upgradeCost(building);
    const isCenter = def.id === 'center';
    const problems: string[] = [];

    if (status && city.isComplete(building)) {
        if (!status.connected) {
            problems.push(
                '🚧 Нет дороги до центра города — здание не работает.',
            );
        }

        if (status.noPower) {
            problems.push('⚡ Не хватает энергии.');
        }

        if (status.starved) {
            problems.push(
                `📦 Не хватает сырья: ${RESOURCES.find((r) => r.id === status.starved)!.name.toLowerCase()}.`,
            );
        }

        if (def.workers && city.employment < 1) {
            problems.push(
                `👷 Рабочих хватает на ${Math.round(city.employment * 100)}% — постройте жильё.`,
            );
        }
    }

    const lines: ReactNode[] = [];

    for (const [resource, rate] of Object.entries(status?.output ?? {})) {
        const meta = RESOURCES.find((r) => r.id === resource)!;

        lines.push(
            <li key={`out-${resource}`}>
                {meta.icon} {meta.name}: <b>{perMinute(rate ?? 0)}</b>
            </li>,
        );
    }

    for (const [resource, rate] of Object.entries(status?.input ?? {})) {
        const meta = RESOURCES.find((r) => r.id === resource)!;

        lines.push(
            <li key={`in-${resource}`}>
                {meta.icon} Тратит {meta.name.toLowerCase()}:{' '}
                <b>{perMinute(-(rate ?? 0))}</b>
            </li>,
        );
    }

    if (def.housing && !isCenter) {
        lines.push(
            <li key="housing">
                👥 Жильцы: <b>{status?.residents ?? 0}</b> /{' '}
                {Math.floor(def.housing * levelHousing(building.level))}
            </li>,
        );
    }

    if (status?.happiness !== null && status?.happiness !== undefined) {
        lines.push(
            <li key="happy">
                {happinessFace(status.happiness)} Уют района:{' '}
                <b>{Math.round(status.happiness)}</b>
            </li>,
        );
    }

    if (def.workers) {
        lines.push(
            <li key="workers">
                👷 Рабочих мест:{' '}
                <b>{Math.floor(def.workers * levelWorkers(building.level))}</b>
            </li>,
        );
    }

    if (def.aura) {
        lines.push(
            <li key="aura">
                😊 Радость вокруг: <b>+{def.aura.happiness}</b> в радиусе{' '}
                {def.aura.radius}
            </li>,
        );
    }

    if (def.boost) {
        lines.push(
            <li key="boost">
                🌬️ Фермам рядом: <b>+{def.boost.percent}%</b>
            </li>,
        );
    }

    if (def.nearby && def.nearby.perTile > 0) {
        lines.push(
            <li key="nearby">
                {def.nearby.terrain === 'forest' ? '🌲 Лес' : '🧱 Скалы'} рядом:{' '}
                <b>{status?.nearbyTiles ?? 0}</b> клеток
            </li>,
        );
    }

    if (status && status.boost > 0) {
        lines.push(
            <li key="boosted">
                ⬆ Бонус мельниц: <b>+{Math.round(status.boost * 100)}%</b>
            </li>,
        );
    }

    if (def.storage) {
        lines.push(<li key="storage">📦 Увеличивает склад</li>);
    }

    if (def.defense) {
        lines.push(
            <li key="defense">
                🛡️ Защита:{' '}
                <b>
                    {Math.floor(
                        def.defense *
                            (isCenter
                                ? 1 + city.state.epoch
                                : levelOutput(building.level)),
                    )}
                </b>
            </li>,
        );
    }

    if (def.power) {
        lines.push(
            <li key="power">
                ⚡ Энергия:{' '}
                <b>+{Math.floor(def.power * levelOutput(building.level))}</b>
            </li>,
        );
    }

    return (
        <aside className="inspector">
            <header className="inspector__head">
                <span className="inspector__icon">{def.icon}</span>
                <div>
                    <h2>{city.nameOf(building)}</h2>
                    {!isCenter && def.id !== 'road' && (
                        <span className="inspector__level">
                            {'★'.repeat(building.level)}
                            {'☆'.repeat(def.maxLevel - building.level)} ·
                            уровень {building.level}
                        </span>
                    )}
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

            <p className="inspector__desc">{def.description}</p>

            {!city.isComplete(building) && (
                <p className="inspector__note">🏗️ Идёт строительство…</p>
            )}

            {problems.map((problem) => (
                <p key={problem} className="inspector__problem">
                    {problem}
                </p>
            ))}

            {lines.length > 0 && <ul className="inspector__stats">{lines}</ul>}

            {!isCenter && def.id !== 'road' && (
                <div className="inspector__actions">
                    <button
                        type="button"
                        className="hud-button hud-button--primary"
                        disabled={
                            Boolean(block) || !city.canAfford(upgradeCost)
                        }
                        onClick={onUpgrade}
                    >
                        ⬆ Улучшить
                        {!block && <CostLine city={city} cost={upgradeCost} />}
                    </button>
                    {block && <span className="inspector__hint">{block}</span>}
                    <div className="inspector__row">
                        <button
                            type="button"
                            className="hud-button"
                            onClick={onMove}
                            title="Перенести здание в другое место"
                        >
                            ↔ Перенести{' '}
                            <CostLine
                                city={city}
                                cost={city.moveCost(building)}
                            />
                        </button>
                        <button
                            type="button"
                            className="hud-button hud-button--danger"
                            onClick={onDemolish}
                            title="Снести (вернётся половина стоимости)"
                        >
                            🧨 Снести
                        </button>
                    </div>
                </div>
            )}

            {isCenter && (
                <p className="inspector__hint">
                    Центр растёт сам — с каждой новой эпохой.
                </p>
            )}
        </aside>
    );
}

// ——————————————————————————————————————————————— Goals

export function Goals({
    city,
    collapsed,
    onToggle,
}: {
    city: City;
    collapsed: boolean;
    onToggle: () => void;
}) {
    const goal = GOALS[city.state.goal];
    const next = EPOCHS[city.state.epoch].next;

    return (
        <aside className={`goals${collapsed ? ' goals--collapsed' : ''}`}>
            <button type="button" className="goals__head" onClick={onToggle}>
                🎯 Цели {goal ? `${city.state.goal}/${GOALS.length}` : ''}{' '}
                <span>{collapsed ? '▾' : '▴'}</span>
            </button>
            {!collapsed && (
                <div className="goals__body">
                    {goal ? (
                        <>
                            <p className="goals__text">{goal.text}</p>
                            <p className="goals__hint">{goal.hint}</p>
                            <p className="goals__reward">
                                Награда:{' '}
                                <CostLine city={city} cost={goal.reward} />
                            </p>
                        </>
                    ) : next ? (
                        <>
                            <p className="goals__text">
                                Путь к эпохе «
                                {EPOCHS[city.state.epoch + 1].name}»
                            </p>
                            <ul className="checklist">
                                {city.epochChecklist().map((item) => (
                                    <li
                                        key={item.label}
                                        className={item.done ? 'done' : ''}
                                    >
                                        {item.done ? '✅' : '⬜'} {item.label}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="goals__text">
                            Вы построили мегаполис! Изучайте технологии и
                            растите дальше.
                        </p>
                    )}
                </div>
            )}
        </aside>
    );
}

// ——————————————————————————————————————————————— Modals

export function Modal({
    title,
    onClose,
    children,
    wide,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div className={`modal__box${wide ? ' modal__box--wide' : ''}`}>
                <header className="modal__head">
                    <h2>{title}</h2>
                    <button
                        type="button"
                        className="inspector__close"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </header>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

export function TechTree({
    city,
    onResearch,
    onClose,
}: {
    city: City;
    onResearch: (id: string) => void;
    onClose: () => void;
}) {
    const last = Math.min(EPOCHS.length - 1, city.state.epoch + 1);
    const science = city.state.res.science;

    return (
        <Modal
            title={`Технологии · 📜 ${compact(science)} знаний (${perMinute(city.rates.science)})`}
            onClose={onClose}
            wide
        >
            <div className="tech-tree">
                {EPOCHS.slice(0, last + 1).map((epoch, index) => (
                    <section
                        key={epoch.year}
                        className={`tech-col${index > city.state.epoch ? ' tech-col--future' : ''}`}
                    >
                        <h3>
                            {epoch.year} · {epoch.name}
                        </h3>
                        {TECHS.filter((tech) => tech.epoch === index).map(
                            (tech) => {
                                const state = city.techState(tech.id);
                                const unlocks = BUILDINGS.filter(
                                    (def) => def.tech === tech.id,
                                );

                                return (
                                    <button
                                        key={tech.id}
                                        type="button"
                                        className={`tech tech--${state}${tech.key ? ' tech--key' : ''}`}
                                        disabled={
                                            state !== 'available' ||
                                            science < tech.cost
                                        }
                                        onClick={() => onResearch(tech.id)}
                                    >
                                        <span className="tech__icon">
                                            {state === 'done'
                                                ? '✅'
                                                : tech.icon}
                                        </span>
                                        <span className="tech__name">
                                            {tech.name}
                                        </span>
                                        <span className="tech__desc">
                                            {tech.description}
                                        </span>
                                        {unlocks.length > 0 && (
                                            <span className="tech__unlocks">
                                                {unlocks
                                                    .map(
                                                        (def) =>
                                                            `${def.icon} ${def.name}`,
                                                    )
                                                    .join(', ')}
                                            </span>
                                        )}
                                        {state !== 'done' && (
                                            <span
                                                className={`tech__cost${science < tech.cost ? ' tech__cost--short' : ''}`}
                                            >
                                                📜 {compact(tech.cost)}
                                                {tech.requires?.length
                                                    ? ` · после: ${tech.requires.map((id) => TECHS.find((t) => t.id === id)!.name).join(', ')}`
                                                    : ''}
                                            </span>
                                        )}
                                    </button>
                                );
                            },
                        )}
                    </section>
                ))}
            </div>
        </Modal>
    );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
    if (values.length < 2) {
        return (
            <div className="sparkline sparkline--empty">
                Данные появятся через минуту игры
            </div>
        );
    }

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const points = values
        .map(
            (value, index) =>
                `${(index / (values.length - 1)) * 300},${90 - ((value - min) / (max - min || 1)) * 80}`,
        )
        .join(' ');

    return (
        <svg
            className="sparkline"
            viewBox="0 0 300 95"
            preserveAspectRatio="none"
        >
            <polyline
                points={`0,95 ${points} 300,95`}
                fill={color}
                opacity="0.15"
            />
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

export function Stats({ city, onClose }: { city: City; onClose: () => void }) {
    const history = city.state.history;
    const counts = CATEGORIES.map((category) => ({
        ...category,
        count: city.state.buildings.filter(
            (b) => b.type !== 'road' && city.def(b).category === category.id,
        ).length,
    }));
    const roads = city.count('road');
    const minutes = Math.floor(city.state.time / 60);

    return (
        <Modal title="Статистика города" onClose={onClose} wide>
            <div className="stats">
                <div className="stats__tiles">
                    <div>
                        <b>{compact(city.score())}</b>
                        <span>очков развития</span>
                    </div>
                    <div>
                        <b>{Math.floor(city.state.population)}</b>
                        <span>жителей</span>
                    </div>
                    <div>
                        <b>
                            {happinessFace(city.happiness)}{' '}
                            {Math.round(city.happiness)}
                        </b>
                        <span>счастье</span>
                    </div>
                    <div>
                        <b>{Math.round(city.employment * 100)}%</b>
                        <span>мест занято</span>
                    </div>
                    <div>
                        <b>{city.state.techs.length}</b>
                        <span>технологий</span>
                    </div>
                    <div>
                        <b>{minutes}</b>
                        <span>минут в игре</span>
                    </div>
                </div>

                <div className="stats__charts">
                    <figure>
                        <figcaption>👥 Население</figcaption>
                        <Sparkline
                            values={history.map((point) => point.population)}
                            color="#4f9ae8"
                        />
                    </figure>
                    <figure>
                        <figcaption>💰 Казна</figcaption>
                        <Sparkline
                            values={history.map((point) => point.gold)}
                            color="#e0a530"
                        />
                    </figure>
                    <figure>
                        <figcaption>😊 Счастье</figcaption>
                        <Sparkline
                            values={history.map((point) => point.happiness)}
                            color="#4aa35a"
                        />
                    </figure>
                </div>

                <div className="stats__table">
                    <h3>Экономика, в минуту</h3>
                    <ul>
                        {RESOURCES.map((resource) => (
                            <li key={resource.id}>
                                {resource.icon} {resource.name}{' '}
                                <b
                                    className={
                                        city.rates[resource.id] < 0 ? 'neg' : ''
                                    }
                                >
                                    {perMinute(city.rates[resource.id])}
                                </b>
                            </li>
                        ))}
                    </ul>
                    <h3>Постройки</h3>
                    <ul>
                        {counts.map((category) => (
                            <li key={category.id}>
                                {category.icon} {category.name}{' '}
                                <b>{category.count}</b>
                            </li>
                        ))}
                        <li>
                            🛤️ Дороги <b>{roads}</b>
                        </li>
                    </ul>
                    <h3>Хроника</h3>
                    <ul>
                        <li>
                            🏗️ Построено <b>{city.state.stats.built}</b>
                        </li>
                        <li>
                            ⬆ Улучшено <b>{city.state.stats.upgraded}</b>
                        </li>
                        <li>
                            🛡️ Набегов отбито <b>{city.state.stats.raidsWon}</b>{' '}
                            · пропущено <b>{city.state.stats.raidsLost}</b>
                        </li>
                    </ul>
                </div>
            </div>
        </Modal>
    );
}

export function EpochPanel({
    city,
    onAdvance,
    onClose,
}: {
    city: City;
    onAdvance: () => void;
    onClose: () => void;
}) {
    const current = EPOCHS[city.state.epoch];
    const nextIndex = city.state.epoch + 1;
    const next = EPOCHS[nextIndex];

    if (!next) {
        return (
            <Modal title="Эпохи" onClose={onClose}>
                <p className="epoch-panel__lead">
                    Ваш город — {current.name.toLowerCase()}. Это вершина пути:
                    дальше только рост, технологии и рекорды очков развития.
                </p>
            </Modal>
        );
    }

    const unlocks = BUILDINGS.filter(
        (def) => def.epoch === nextIndex && !def.hidden,
    );
    const checklist = city.epochChecklist();
    const ready = city.canAdvance();

    return (
        <Modal title="Новая эпоха" onClose={onClose}>
            <div className="epoch-panel">
                <div className="epoch-panel__path">
                    <div>
                        <span>{current.year}</span>
                        <b>{current.name}</b>
                    </div>
                    <span className="epoch-panel__arrow">→</span>
                    <div className="epoch-panel__next">
                        <span>{next.year}</span>
                        <b>{next.name}</b>
                    </div>
                </div>
                <p className="epoch-panel__lead">{next.tagline}</p>

                <ul className="checklist">
                    {checklist.map((item) => (
                        <li
                            key={item.label}
                            className={item.done ? 'done' : ''}
                        >
                            {item.done ? '✅' : '⬜'} {item.label}
                        </li>
                    ))}
                </ul>

                <h3>Что откроется</h3>
                <div className="epoch-panel__unlocks">
                    {unlocks.map((def) => (
                        <span key={def.id} title={def.description}>
                            {def.icon} {buildingName(def, nextIndex)}
                        </span>
                    ))}
                    <span>
                        🗺️ Больше земли: {next.territory * 2 + 2}×
                        {next.territory * 2 + 2}
                    </span>
                    <span>🎨 Новая архитектура</span>
                </div>

                <button
                    type="button"
                    className="hud-button hud-button--primary hud-button--big"
                    disabled={!ready}
                    onClick={onAdvance}
                >
                    {ready
                        ? `🚀 Перейти в ${next.year} год`
                        : 'Выполните условия'}
                </button>
            </div>
        </Modal>
    );
}

export function EpochSplash({
    epoch,
    onDone,
}: {
    epoch: number;
    onDone: () => void;
}) {
    const info = EPOCHS[epoch];
    const [year, setYear] = useState(EPOCHS[Math.max(0, epoch - 1)].year);

    useEffect(() => {
        const start = performance.now();
        const from = EPOCHS[Math.max(0, epoch - 1)].year;
        let frame = 0;

        const step = (now: number) => {
            const progress = Math.min(1, (now - start) / 1600);

            setYear(
                Math.round(
                    from + (info.year - from) * (1 - Math.pow(1 - progress, 3)),
                ),
            );

            if (progress < 1) {
                frame = requestAnimationFrame(step);
            }
        };

        frame = requestAnimationFrame(step);

        const timer = window.setTimeout(onDone, 5200);

        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [epoch, info.year, onDone]);

    return (
        <div className="epoch-splash" onClick={onDone} role="status">
            <div className="epoch-splash__year">{year}</div>
            <div className="epoch-splash__name">{info.name}</div>
            <p className="epoch-splash__tagline">{info.tagline}</p>
            <span className="epoch-splash__skip">
                нажмите, чтобы продолжить
            </span>
        </div>
    );
}
