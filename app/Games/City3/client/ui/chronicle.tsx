/**
 * The race against history on screen (gdd §2.3, §11; ui-spec §5.1–§5.4):
 * the calendar chip with the live lead and its tooltip, the race line, the
 * Chronicle sheet (era rows, score, leaderboard tabs), the era banner that
 * replaces v2's splash, «Что нового», and the Town Hall card — the gate
 * checklist, stars, the Upgrade button, Spirit of the Age, policies, the
 * loan offer and the storage cap.
 */

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TaxPolicy } from '../engine/content/types';
import type { Game, GateLine } from '../engine/sim/game';
import {
    Bar,
    CostLine,
    formatExact,
    formatNumber,
    formatRate,
    formatSigned,
    Modal,
    MoneyIcon,
    plural,
    years,
} from './common';

/** Year-ring geometry (the calendar chip). */
const RING = 2 * Math.PI * 15;

/**
 * Where a year sits on the race line: six equal segments, one per era
 * (0→1000, 1000→1500, …, 2000→2100); 6 at the end.
 */
export function racePosition(year: number, history: number[]): number {
    const last = history.length - 1;

    if (year >= history[last]) {
        return last;
    }

    for (let i = 0; i < last; i++) {
        if (year < history[i + 1]) {
            return (
                i +
                Math.max(0, year - history[i]) / (history[i + 1] - history[i])
            );
        }
    }

    return last;
}

/** «★★☆». */
export function starStrip(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
}

/** The lead tooltip (ui-spec §8 `hud.lead.tooltip`), names in the nominative. */
export function leadText(game: Game): string {
    const lead = game.lead();
    const value = Math.round(lead.lead);
    const next = game.nextEpoch;

    if (value < 0) {
        return `История догоняет: город на ${years(-value)} позади.`;
    }

    const parts = [
        `Опережение истории: ${formatSigned(value)} ${plural(value, 'год', 'года', 'лет')}.`,
        next
            ? `Ваш город — как Европа ${formatExact(lead.cityYear)} года: ${game.epoch.name}, ${Math.round(lead.share * 100)} % пути до эпохи «${next.name}».`
            : `Ваш город — в эпохе «${game.epoch.name}», последней в летописи.`,
    ];
    const cause = game.leadCause;

    if (cause) {
        parts.push(
            `Последнее: «${cause.label}» ${formatSigned(cause.years)} ${plural(cause.years, 'год', 'года', 'лет')}.`,
        );
    }

    if (game.leadFalling()) {
        parts.push('История догоняет: опережение падает.');
    }

    return parts.join(' ');
}

/** The calendar chip: year with its ring, era, live lead. Tap → Chronicle. */
export function CalendarChip({
    game,
    onOpen,
}: {
    game: Game;
    onOpen: () => void;
}) {
    const lead = Math.round(game.lead().lead);
    const falling = game.leadFalling();
    const tone = lead < 0 ? 'behind' : falling ? 'falling' : 'ahead';
    const spy = game.clock.secondsPerYear;
    const progress = (game.state.time % spy) / spy;
    const text = leadText(game);

    return (
        <button
            type="button"
            className="hud-calendar"
            onClick={onOpen}
            aria-label={`${game.year} год, ${game.epoch.name}. ${text} Открыть летопись`}
        >
            <svg
                className="hud-calendar__ring"
                viewBox="0 0 36 36"
                aria-hidden="true"
            >
                <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="hud-calendar__track"
                />
                <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="hud-calendar__fill"
                    strokeDasharray={`${RING * progress} ${RING}`}
                />
            </svg>
            <span className="hud-calendar__body">
                <strong>{game.year} г.</strong>
                <span>{game.epoch.name}</span>
            </span>
            <span className={`hud-calendar__lead hud-calendar__lead--${tone}`}>
                {falling ? '▼' : '⚑'} {formatSigned(lead)}
            </span>
            <span className="hud-calendar__tip" role="tooltip">
                {text}
            </span>
        </button>
    );
}

/** Six equal era segments; the tick is the calendar, the pennant the city. */
export function RaceLine({ game }: { game: Game }) {
    const history = game.content.epochs.map((epoch) => epoch.year);
    const segments = history.length - 1;
    const calendar = racePosition(game.year, history);
    const lead = game.lead();
    const city = Math.min(segments, game.state.epoch + lead.share);
    const at = (position: number) => `${(position / segments) * 100}%`;

    return (
        <div className="race" aria-hidden="true">
            <div className="race__track">
                {game.content.epochs.slice(1).map((epoch, index) => (
                    <span
                        key={epoch.id}
                        className={`race__segment${index < game.state.epoch ? ' race__segment--done' : ''}`}
                        title={epoch.name}
                    />
                ))}
                <span
                    className="race__fill"
                    style={{
                        left: at(Math.min(calendar, city)),
                        width: at(Math.abs(city - calendar)),
                    }}
                />
                <span className="race__tick" style={{ left: at(calendar) }} />
                <span className="race__pennant" style={{ left: at(city) }}>
                    ⚑
                </span>
            </div>
            <div className="race__labels">
                {game.content.epochs.slice(0, -1).map((epoch, index) => (
                    <span key={epoch.id}>{index === 0 ? '0' : epoch.year}</span>
                ))}
                <span>{history[segments]}</span>
            </div>
        </div>
    );
}

interface BoardRow {
    rank: number;
    name: string | null;
    score: number;
    is_me?: boolean;
    details?: {
        epoch_name?: string | null;
        year?: number;
        lead?: number;
        stars?: number;
    };
}

type BoardTab = 'overall' | 'chronicle' | 'era';

const TABS: [BoardTab, string][] = [
    ['overall', 'Общий'],
    ['chronicle', 'Летопись'],
    ['era', 'Эта эпоха'],
];

function Leaderboard() {
    const [tab, setTab] = useState<BoardTab>('overall');
    const [rows, setRows] = useState<BoardRow[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        api<{ entries?: BoardRow[] }>(`leaderboard?tab=${tab}`)
            .then((data) => {
                if (!cancelled) {
                    setRows(Array.isArray(data?.entries) ? data.entries : []);
                    setFailed(false);
                }
            })
            .catch(() => !cancelled && setFailed(true));

        return () => {
            cancelled = true;
        };
    }, [tab]);

    return (
        <section className="chronicle__board">
            <div className="hud-speed" role="tablist" aria-label="Таблица">
                {TABS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-pressed={tab === id}
                        onClick={() => {
                            setRows(null);
                            setTab(id);
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {failed ? (
                <p className="epoch-panel__note">Таблица сейчас недоступна.</p>
            ) : !rows ? (
                <p className="epoch-panel__note">Загружаем…</p>
            ) : rows.length === 0 ? (
                <p className="epoch-panel__note">Пока никого.</p>
            ) : (
                <ol className="chronicle__rows">
                    {rows.map((row) => (
                        <li
                            key={`${row.rank}-${row.name}-${row.score}`}
                            className={row.is_me ? 'is-me' : ''}
                        >
                            <b>{row.rank}</b>
                            <span>{row.name ?? 'Игрок'}</span>
                            <small>
                                {row.details?.epoch_name ?? ''} ·{' '}
                                {row.details?.year ?? 0} г.
                            </small>
                            <small>
                                {formatSigned(row.details?.lead ?? 0)}
                            </small>
                            <span className="chronicle__stars">
                                ★ {row.details?.stars ?? 0}
                            </span>
                            <b>{formatNumber(row.score)}</b>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

/** The Chronicle (ui-spec §5.2): race line, one row per era entered, score, leaderboard. */
export function ChronicleSheet({
    game,
    onClose,
}: {
    game: Game;
    onClose: () => void;
}) {
    const entries = game.chronicle();
    const score = game.scoreBreakdown();
    const first = game.content.epochs[1];

    return (
        <Modal title="Летопись" onClose={onClose} wide>
            <div className="chronicle">
                <RaceLine game={game} />
                <p className="epoch-panel__lead">{leadText(game)}</p>
                {entries.length === 0 ? (
                    <p className="epoch-panel__note">
                        Первая звезда — войти в эпоху «{first?.name}» до{' '}
                        {first?.year} года.
                    </p>
                ) : (
                    <table className="chronicle__eras">
                        <thead>
                            <tr>
                                <th>Эпоха</th>
                                <th>Год входа</th>
                                <th>Опережение</th>
                                <th>Звёзды</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.era}>
                                    <td>
                                        {game.content.epoch(entry.era).name}
                                    </td>
                                    <td>{formatExact(entry.year)}</td>
                                    <td>
                                        {entry.lead >= 0
                                            ? `на ${years(entry.lead)} раньше истории`
                                            : `на ${years(-entry.lead)} позже истории`}
                                    </td>
                                    <td className="chronicle__stars">
                                        {starStrip(entry.stars)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <div className="stats__tiles chronicle__score">
                    <div>
                        <b>{formatNumber(score.total)}</b>
                        <span>очков</span>
                    </div>
                    <div>
                        <b>{formatNumber(score.chronicle)}</b>
                        <span>летопись</span>
                    </div>
                    <div>
                        <b>{formatNumber(score.city)}</b>
                        <span>город</span>
                    </div>
                    <div>
                        <b>{formatNumber(score.land)}</b>
                        <span>земля</span>
                    </div>
                    <div>
                        <b>{formatNumber(score.achievements)}</b>
                        <span>достижения</span>
                    </div>
                </div>
                <p className="epoch-panel__note">
                    Деньги очков не дают: летопись — это вход в эпохи раньше
                    истории и звёзды; город — пик жителей и их довольство за 50
                    лет.
                    {game.state.economy.flags.tester &&
                        ' Город с инструментами тестера в таблицу не попадает.'}
                </p>
                <Leaderboard />
            </div>
        </Modal>
    );
}

/** The 2.5 s era banner (ui-spec §5.4): no splash, no flash, no count-up. */
export function EraBanner({
    game,
    epoch,
    stars,
    lead,
    onWhatsNew,
    onDone,
}: {
    game: Game;
    epoch: number;
    stars: number;
    lead: number;
    onWhatsNew: () => void;
    onDone: () => void;
}) {
    const info = game.content.epoch(epoch);

    useEffect(() => {
        const timer = window.setTimeout(onDone, 2500);

        return () => window.clearTimeout(timer);
    }, [onDone]);

    return (
        <div className="era-banner" role="status">
            <span className="era-banner__coin">
                <MoneyIcon face={info.currency} />
            </span>
            <div>
                <b>{info.name}</b>
                <span className="era-banner__stars">{starStrip(stars)}</span>
                <small>
                    {lead >= 0
                        ? `На ${years(lead)} раньше истории!`
                        : `На ${years(-lead)} позже истории`}
                </small>
            </div>
            <button type="button" className="hud-button" onClick={onWhatsNew}>
                Что нового
            </button>
        </div>
    );
}

/** «Что нового» (gdd §2.4): what the current era opened and the Golden Age. */
export function WhatsNew({
    game,
    onClose,
}: {
    game: Game;
    onClose: () => void;
}) {
    const era = game.epoch;
    const unlocks = game.content.buildings.filter(
        (def) => !def.hidden && def.levels[0].epoch === era.id,
    );
    const upgrades = game.content.buildings.filter(
        (def) =>
            def.levels[0].epoch !== era.id &&
            def.levels.some((level) => level.epoch === era.id),
    );
    const techs = game.content.techs.filter((tech) => tech.epoch === era.id);
    const golden = game.golden();
    const last = game.chronicle().at(-1);

    return (
        <Modal title={`Что нового: ${era.name}`} onClose={onClose}>
            <div className="epoch-panel">
                <p className="epoch-panel__lead">{era.tagline}</p>
                <p className="epoch-panel__note">
                    <MoneyIcon face={era.currency} /> 1 {era.currency.symbol} =
                    1{' '}
                    {
                        game.content.epoch(Math.max(0, game.state.epoch - 1))
                            .currency.symbol
                    }{' '}
                    — та же казна, новая монета: «{era.currency.name}».
                </p>
                {last && last.stars > 0 && (
                    <p className="epoch-panel__note">
                        ✨ Золотой век: {last.stars * 5} % к налогам, экспорту и
                        производству на 10 лет
                        {golden > 0
                            ? ` (сейчас +${Math.round(golden * 100)} %)`
                            : ''}
                        , +3 к довольству.
                    </p>
                )}
                <h3>Новые постройки</h3>
                <div className="epoch-panel__unlocks">
                    {unlocks.map((def) => (
                        <span key={def.id} title={def.description}>
                            {def.icon} {def.levels[0].name}
                        </span>
                    ))}
                    {upgrades.length > 0 && (
                        <span
                            title={upgrades.map((def) => def.name).join(', ')}
                        >
                            ⬆ новые уровни:{' '}
                            {upgrades.map((def) => def.icon).join(' ')}
                        </span>
                    )}
                </div>
                <h3>Открытия эпохи</h3>
                <div className="epoch-panel__unlocks">
                    {techs.map((tech) => (
                        <span key={tech.id} title={tech.description}>
                            {tech.icon} {tech.name}
                        </span>
                    ))}
                </div>
                <p className="epoch-panel__note">
                    Уже построенное не меняется само: улицы и дома взрослеют,
                    когда вы их улучшаете. Небо и одежда горожан меняются
                    постепенно, за 20 лет.
                </p>
            </div>
        </Modal>
    );
}

function lineText(line: GateLine): string {
    return line.kind === 'population' || line.target > 1
        ? `${formatNumber(line.current)} / ${formatNumber(line.target)}`
        : line.done
          ? 'готово'
          : 'нет';
}

const TAX_HINTS: Record<TaxPolicy, string> = {
    low: 'налоги ×0,8, +8 к довольству',
    normal: 'без изменений',
    high: 'налоги ×1,2, −10 к довольству',
};

/** The Town Hall card (ui-spec §5.2 TownHallSheet). */
export function TownHallCard({
    game,
    onClose,
    onFix,
    onPrice,
}: {
    game: Game;
    onClose: () => void;
    /** Leads a gate line to its fix (build tray at the item, discoveries). */
    onFix: (line: GateLine) => void;
    onPrice: () => void;
}) {
    const center = game.center;
    const next = game.nextEpoch;
    const upgrade = game.townHallUpgrade();
    const lines = game.gateLines();
    const block = game.gateBlock();
    const building = game.townHallBuilding();
    const affordable = upgrade ? game.canAfford(upgrade.cost) : false;
    const economy = game.state.economy;
    const rules = game.content.world.economy.policies;
    const taxLock = game.policyLock('tax');
    const denseLock = game.policyLock('dense');
    const offer = game.loanOffer();
    const spy = game.clock.secondsPerYear;
    const stars = next?.entry?.stars;
    const year = game.year;

    return (
        <Modal
            title={`Ратуша · ${center ? game.levelDef(center).name : ''}`}
            onClose={onClose}
        >
            <div className="epoch-panel town-hall">
                {!next || !upgrade ? (
                    <p className="epoch-panel__lead">
                        Город дошёл до эпохи «{game.epoch.name}» — последней в
                        летописи. Растите город, собирайте достижения: история
                        догоняет, но не отнимает сделанного.
                    </p>
                ) : (
                    <>
                        <p className="epoch-panel__lead">
                            Следующая эпоха: <b>{next.name}</b> ({next.year} г.
                            по истории). Готово{' '}
                            {lines.filter((l) => l.done).length} из{' '}
                            {lines.length}.
                        </p>
                        <ul className="gate">
                            {lines.map((line) => (
                                <li key={line.label}>
                                    <button
                                        type="button"
                                        className={`gate__line${line.done ? ' gate__line--done' : ''}`}
                                        onClick={() => onFix(line)}
                                        disabled={line.done}
                                    >
                                        <span>
                                            {line.done ? '✅' : '⬜'}{' '}
                                            {line.label}
                                        </span>
                                        <small>{lineText(line)}</small>
                                        <Bar
                                            value={
                                                line.current /
                                                Math.max(1, line.target)
                                            }
                                            tone="accent"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {stars && (
                            <div
                                className="gate__stars"
                                aria-label="Звёзды за вход"
                            >
                                {(
                                    [
                                        [3, stars[1]],
                                        [2, stars[0]],
                                        [1, next.year],
                                    ] as const
                                ).map(([count, by], index, all) => {
                                    const reachable = year <= by;
                                    const best =
                                        reachable &&
                                        all.findIndex(([, y]) => year <= y) ===
                                            index;

                                    return (
                                        <span
                                            key={count}
                                            className={`gate__star${reachable ? '' : ' gate__star--gone'}${best ? ' gate__star--best' : ''}`}
                                        >
                                            {'★'.repeat(count)} до{' '}
                                            {formatExact(by)} года
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        {upgrade.spirit > 0 && (
                            <p className="epoch-panel__note">
                                ⏳ История ушла вперёд: −
                                {Math.round(upgrade.spirit * 100)} % к улучшению
                                ратуши и открытиям.
                            </p>
                        )}
                        {building && center ? (
                            <div className="gate__building">
                                <b>«{upgrade.level.name}» строится</b>
                                <Bar
                                    value={
                                        (game.state.time - center.buildStart) /
                                        Math.max(
                                            1,
                                            center.buildEnd - center.buildStart,
                                        )
                                    }
                                    tone="accent"
                                />
                                <small>
                                    Эпоха «{next.name}» начнётся в{' '}
                                    {game.clock.year(center.buildEnd)} году.
                                </small>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="hud-button hud-button--primary hud-button--big"
                                    disabled={Boolean(block) || !affordable}
                                    onClick={() => {
                                        if (game.advanceEpoch().ok) {
                                            onClose();
                                        }
                                    }}
                                >
                                    {block ??
                                        `Улучшить до «${upgrade.level.name}»`}{' '}
                                    <CostLine game={game} cost={upgrade.cost} />{' '}
                                    · стройка {years(upgrade.buildTime / spy)}
                                </button>
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={onPrice}
                                >
                                    Как считается цена
                                </button>
                            </>
                        )}
                        {!block && !building && !affordable && (
                            <LoanOffer game={game} offer={offer} />
                        )}
                    </>
                )}

                <h3>Указы</h3>
                <div className="policy">
                    <span>Налоги</span>
                    <div className="hud-speed" role="group" aria-label="Налоги">
                        {(['low', 'normal', 'high'] as const).map((id) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={economy.policy === id}
                                disabled={
                                    Boolean(taxLock) && economy.policy !== id
                                }
                                title={TAX_HINTS[id]}
                                onClick={() => game.setTaxPolicy(id)}
                            >
                                {rules.tax.options[id].name}
                            </button>
                        ))}
                    </div>
                    <small>{taxLock ?? TAX_HINTS[economy.policy]}</small>
                </div>
                <div className="policy">
                    <span>{rules.dense.name}</span>
                    <label className="game-menu__toggle">
                        <input
                            type="checkbox"
                            checked={economy.dense}
                            disabled={Boolean(denseLock)}
                            onChange={(event) =>
                                game.setDense(event.target.checked)
                            }
                        />
                        жильё +{Math.round(rules.dense.housing * 100)} %,
                        довольство {rules.dense.happiness}, поездки +
                        {Math.round(rules.dense.trips * 100)} %
                    </label>
                    {denseLock && <small>{denseLock}</small>}
                </div>
                {economy.loan > 0 && (
                    <p className="epoch-panel__note">
                        🏦 Долг казны: {formatExact(economy.loan)} · проценты{' '}
                        {formatRate(-game.stats.budget.costs.interest)}. Гасится
                        сам четвертью чистого дохода.
                    </p>
                )}
                <p className="epoch-panel__note">
                    📦 Склады: до {formatExact(game.stats.caps.food ?? 0)} еды,
                    стройматериалов и товаров.
                </p>
            </div>
        </Modal>
    );
}

/** «Ссуда казны: до 5 300 под 10 % в год» (gdd §4.10). */
export function LoanOffer({ game, offer }: { game: Game; offer: number }) {
    const loan = game.content.world.economy.treasury.loan;

    if (offer <= 0) {
        return null;
    }

    return (
        <div className="loan">
            <span>
                🏦 Ссуда казны: до {formatExact(offer)} под{' '}
                {Math.round(loan.ratePerYear * 100)} % в год. Возвращается сама:{' '}
                {Math.round(loan.repayShareOfNet * 100)} % чистого дохода.
            </span>
            <button
                type="button"
                className="hud-button"
                onClick={() => game.takeLoan(offer)}
            >
                Взять ссуду
            </button>
        </div>
    );
}
