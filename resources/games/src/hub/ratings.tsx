import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest, GameApiError, gameApi } from '../shared/api';
import { format, locale, plural, t } from '../shared/i18n';

/** Play time needed before a game can be rated (mirrors the server's rule). */
const SECONDS_TO_RATE = 300;

export interface Review {
    name: string;
    stars: number;
    comment: string;
    at: string | null;
    is_me: boolean;
}

/** GET /api/games/ratings, one entry per playable game. */
export interface GameRatings {
    average: number | null;
    count: number;
    distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
    mine: { stars: number; comment: string | null } | null;
    my_seconds: number;
    can_rate: boolean;
    recent: Review[];
}

export type RatingsSummary = Record<string, GameRatings>;

/** How far a city has come… */
interface CityDetails {
    epoch: number | string;
    epoch_name?: string | null;
    year: number;
    population: number;
}

/** …or what a Sandbox player has done. */
interface SandboxDetails {
    kills: number;
    trees: number;
    artifacts: number;
}

type LeaderDetails = CityDetails | SandboxDetails;

interface LeaderEntry {
    rank: number;
    /** Null when the player has no display name. */
    name: string | null;
    score: number;
    details: LeaderDetails;
    is_me: boolean;
}

interface Leaderboard {
    game: string;
    entries: LeaderEntry[];
    me: Omit<LeaderEntry, 'is_me'> | null;
}

const numbers = new Intl.NumberFormat(locale);
const average = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const dates = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
});

function Stars({ value }: { value: number }) {
    return (
        <span
            className="stars"
            role="img"
            aria-label={plural(t.stars_label, value)}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={star <= value ? 'stars__on' : undefined}
                    aria-hidden="true"
                >
                    ★
                </span>
            ))}
        </span>
    );
}

/** «★ 4.6 · 23 оценки» under a game card's title. */
export function RatingLine({ ratings }: { ratings: GameRatings }) {
    if (ratings.count === 0 || ratings.average === null) {
        return <p className="game-card__rating">☆ {t.rating_none}</p>;
    }

    return (
        <p className="game-card__rating">
            <span className="game-card__rating-star" aria-hidden="true">
                ★
            </span>{' '}
            <strong>{average.format(ratings.average)}</strong> ·{' '}
            {plural(t.ratings_count, ratings.count)}
        </p>
    );
}

/**
 * A modal on the native <dialog>: focus stays inside, Esc and a click on
 * the backdrop close it.
 */
function Modal({
    title,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = ref.current;

        if (dialog && !dialog.open) {
            dialog.showModal();
        }

        return () => dialog?.close();
    }, []);

    return (
        <dialog
            ref={ref}
            className={`hub-modal${wide ? ' hub-modal--wide' : ''}`}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="hub-modal__box">
                <header className="hub-modal__head">
                    <h2 id={titleId}>{title}</h2>
                    <button
                        type="button"
                        className="hub-modal__close"
                        aria-label={t.close}
                        title={t.close}
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </header>
                {children}
            </div>
        </dialog>
    );
}

/** Stars and an optional comment; open only after 5 minutes of play. */
export function RateDialog({
    slug,
    title,
    ratings,
    onSaved,
    onClose,
}: {
    slug: string;
    title: string;
    ratings: GameRatings;
    onSaved: (ratings: GameRatings) => void;
    onClose: () => void;
}) {
    const [stars, setStars] = useState(ratings.mine?.stars ?? 0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState(ratings.mine?.comment ?? '');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        text: string;
        bad: boolean;
    } | null>(null);

    const send = async (method: 'PUT' | 'DELETE') => {
        if (method === 'PUT' && stars === 0) {
            setMessage({ text: t.rate_pick, bad: true });

            return;
        }

        setBusy(true);
        setMessage(null);

        try {
            const updated = await gameApi<GameRatings>(`${slug}/rating`, {
                method,
                body: method === 'PUT' ? { stars, comment } : undefined,
            });

            onSaved(updated);

            if (method === 'PUT') {
                setMessage({ text: t.rate_saved, bad: false });
            } else {
                setStars(0);
                setComment('');
            }
        } catch (error) {
            setMessage({
                text:
                    error instanceof GameApiError && error.message
                        ? error.message
                        : t.load_error,
                bad: true,
            });
        } finally {
            setBusy(false);
        }
    };

    const minutesLeft = Math.max(
        1,
        Math.ceil((SECONDS_TO_RATE - ratings.my_seconds) / 60),
    );

    return (
        <Modal title={format(t.rate_title, { game: title })} onClose={onClose}>
            {ratings.can_rate ? (
                <form
                    className="rate-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void send('PUT');
                    }}
                >
                    <div
                        className="rate-form__stars"
                        role="group"
                        aria-label={t.rate}
                        onMouseLeave={() => setHover(0)}
                    >
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className={
                                    star <= (hover || stars)
                                        ? 'is-on'
                                        : undefined
                                }
                                aria-label={plural(t.stars_label, star)}
                                aria-pressed={stars === star}
                                onMouseEnter={() => setHover(star)}
                                onFocus={() => setHover(star)}
                                onBlur={() => setHover(0)}
                                onClick={() => setStars(star)}
                            >
                                ★
                            </button>
                        ))}
                    </div>

                    <label className="rate-form__label">
                        {t.rate_comment}
                        <textarea
                            value={comment}
                            maxLength={500}
                            rows={4}
                            placeholder={t.rate_comment_placeholder}
                            onChange={(event) => setComment(event.target.value)}
                        />
                    </label>
                    <span className="rate-form__counter" aria-hidden="true">
                        {comment.length}/500
                    </span>

                    {message && (
                        <p
                            className={`rate-form__message${message.bad ? ' rate-form__message--bad' : ''}`}
                            role="status"
                        >
                            {message.text}
                        </p>
                    )}

                    <div className="rate-form__actions">
                        {ratings.mine && (
                            <button
                                type="button"
                                className="hub-button hub-button--danger"
                                disabled={busy}
                                onClick={() => void send('DELETE')}
                            >
                                🗑 {t.rate_delete}
                            </button>
                        )}
                        <button
                            type="submit"
                            className="hub-button"
                            disabled={busy}
                        >
                            {t.rate_save}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="rate-locked">
                    <span className="rate-locked__icon" aria-hidden="true">
                        ⏳
                    </span>
                    <p>
                        <strong>
                            {format(t.rate_locked, { n: minutesLeft })}
                        </strong>
                    </p>
                    <p>{t.rate_locked_hint}</p>
                </div>
            )}
        </Modal>
    );
}

function detailsLine(details: LeaderDetails): string {
    if ('kills' in details) {
        return format(t.board_details_sandbox, {
            kills: numbers.format(details.kills),
            trees: numbers.format(details.trees),
            artifacts: details.artifacts,
        });
    }

    const epoch =
        typeof details.epoch === 'number'
            ? (t.epochs[details.epoch] ?? '')
            : (details.epoch_name ?? details.epoch);

    return format(t.board_details, {
        epoch,
        population: numbers.format(details.population),
    });
}

function LeadersTab({ slug, api }: { slug: string; api?: string }) {
    const [board, setBoard] = useState<Leaderboard | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;

        (api
            ? apiRequest<Leaderboard>(`${api}/leaderboard`)
            : gameApi<Leaderboard>(`${slug}/leaderboard`)
        )
            .then((data) => alive && setBoard(data))
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [slug, api]);

    if (failed) {
        return <p className="board__note">{t.load_error}</p>;
    }

    if (!board) {
        return (
            <div className="board__skeleton" aria-busy="true">
                <span className="sr-only">{t.loading}</span>
                {[0, 1, 2, 3, 4].map((row) => (
                    <span key={row} />
                ))}
            </div>
        );
    }

    if (board.entries.length === 0) {
        return <p className="board__note">{t.board_empty}</p>;
    }

    const meListed = board.entries.some((entry) => entry.is_me);

    return (
        <>
            <div className="board__scroll">
                <table className="board">
                    <thead>
                        <tr>
                            <th scope="col">{t.col_rank}</th>
                            <th scope="col">{t.col_player}</th>
                            <th scope="col" className="board__progress">
                                {t.col_progress}
                            </th>
                            <th scope="col" className="board__score">
                                {t.col_score}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {board.entries.map((entry, index) => (
                            <tr
                                key={index}
                                className={entry.is_me ? 'is-me' : undefined}
                                aria-current={entry.is_me ? 'true' : undefined}
                            >
                                <td className="board__rank">
                                    {entry.rank <= 3
                                        ? ['🥇', '🥈', '🥉'][entry.rank - 1]
                                        : entry.rank}
                                </td>
                                <td>
                                    {entry.name ?? t.board_anonymous}
                                    {entry.is_me && (
                                        <span className="board__you">
                                            {t.board_you}
                                        </span>
                                    )}
                                    <small className="board__details-inline">
                                        {detailsLine(entry.details)}
                                    </small>
                                </td>
                                <td className="board__progress">
                                    {detailsLine(entry.details)}
                                </td>
                                <td className="board__score">
                                    {numbers.format(entry.score)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!meListed && (
                <p className="board__me">
                    {board.me
                        ? `${t.board_me}: #${board.me.rank} · ${numbers.format(board.me.score)}`
                        : t.board_not_played}
                </p>
            )}
        </>
    );
}

function ReviewsTab({ ratings }: { ratings: GameRatings }) {
    const most = Math.max(1, ...Object.values(ratings.distribution));

    return (
        <>
            <div className="reviews__summary">
                <div className="reviews__average">
                    <strong>
                        {ratings.average === null
                            ? '—'
                            : average.format(ratings.average)}
                    </strong>
                    <Stars value={Math.round(ratings.average ?? 0)} />
                    <span>
                        {ratings.count === 0
                            ? t.rating_none
                            : plural(t.ratings_count, ratings.count)}
                    </span>
                </div>
                <ul
                    className="reviews__bars"
                    aria-label={t.reviews_distribution}
                >
                    {(['5', '4', '3', '2', '1'] as const).map((star) => (
                        <li key={star}>
                            <span aria-hidden="true">{star}★</span>
                            <span className="reviews__bar" aria-hidden="true">
                                <span
                                    style={{
                                        width: `${(ratings.distribution[star] / most) * 100}%`,
                                    }}
                                />
                            </span>
                            <span>
                                <span className="sr-only">
                                    {plural(t.stars_label, Number(star))}:{' '}
                                </span>
                                {numbers.format(ratings.distribution[star])}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {ratings.recent.length === 0 ? (
                <p className="board__note">{t.reviews_empty}</p>
            ) : (
                <ul className="reviews__list">
                    {ratings.recent.map((review, index) => (
                        <li
                            key={index}
                            className={review.is_me ? 'is-me' : undefined}
                        >
                            <div className="reviews__head">
                                <strong>
                                    {review.name}
                                    {review.is_me && (
                                        <span className="board__you">
                                            {t.board_you}
                                        </span>
                                    )}
                                </strong>
                                <Stars value={review.stars} />
                                {review.at && (
                                    <time dateTime={review.at}>
                                        {dates.format(new Date(review.at))}
                                    </time>
                                )}
                            </div>
                            <p>{review.comment}</p>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/** The game's leaderboard and its reviews, as two tabs. */
export function LeaderboardDialog({
    slug,
    api,
    title,
    ratings,
    onClose,
}: {
    slug: string;
    /** The game's own API, when its leaderboard lives there. */
    api?: string;
    title: string;
    ratings: GameRatings | null;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<'leaders' | 'reviews'>('leaders');
    const baseId = useId();
    const tabs = [
        { id: 'leaders', label: `🏆 ${t.tab_leaders}` },
        { id: 'reviews', label: `💬 ${t.tab_reviews}` },
    ] as const;

    return (
        <Modal
            title={format(t.board_title, { game: title })}
            onClose={onClose}
            wide
        >
            <div className="hub-tabs" role="tablist">
                {tabs.map((item, index) => (
                    <button
                        key={item.id}
                        id={`${baseId}-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-controls={`${baseId}-panel`}
                        tabIndex={tab === item.id ? 0 : -1}
                        onClick={() => setTab(item.id)}
                        onKeyDown={(event) => {
                            if (
                                event.key === 'ArrowRight' ||
                                event.key === 'ArrowLeft'
                            ) {
                                const next = tabs[(index + 1) % tabs.length];

                                setTab(next.id);
                                document
                                    .getElementById(`${baseId}-tab-${next.id}`)
                                    ?.focus();
                            }
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div
                id={`${baseId}-panel`}
                className="hub-tabs__panel"
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${tab}`}
            >
                {tab === 'leaders' ? (
                    <LeadersTab slug={slug} api={api} />
                ) : ratings ? (
                    <ReviewsTab ratings={ratings} />
                ) : (
                    <p className="board__note">{t.load_error}</p>
                )}
            </div>
        </Modal>
    );
}
