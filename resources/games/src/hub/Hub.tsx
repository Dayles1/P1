import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { gameApi } from '../shared/api';
import { format, plural, t } from '../shared/i18n';
import { CATALOG } from './catalog';
import type { Genre } from './catalog';
import { LeaderboardDialog, RateDialog, RatingLine } from './ratings';
import type { GameRatings, RatingsSummary } from './ratings';

interface GameProgress {
    epoch: number | string;
    epoch_name?: string | null;
    year: number;
    population: number;
    score: number;
}

interface Progress {
    city: GameProgress | null;
    epochs: GameProgress | null;
}

/** The Games menu: every game as a card, with a genre filter. */
export function Hub({ homeUrl }: { homeUrl: string }) {
    const [genre, setGenre] = useState<Genre | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [resetting, setResetting] = useState<string | null>(null);
    const [ratings, setRatings] = useState<RatingsSummary | null>(null);
    const [dialog, setDialog] = useState<{
        kind: 'rate' | 'board';
        slug: string;
        title: string;
    } | null>(null);

    const loadProgress = useCallback(
        () =>
            gameApi<Progress>('progress')
                .then(setProgress)
                .catch(() => setProgress(null)),
        [],
    );

    useEffect(() => {
        document.title = t.games;
        void loadProgress();
        gameApi<RatingsSummary>('ratings')
            .then(setRatings)
            .catch(() => setRatings(null));
    }, [loadProgress]);

    const updateRatings = (slug: string, updated: GameRatings) =>
        setRatings((current) => ({ ...current, [slug]: updated }));

    const reset = async (slug: string, resetPath: string, title: string) => {
        if (!window.confirm(format(t.reset_confirm, { game: title }))) {
            return;
        }

        setResetting(slug);

        try {
            await gameApi(resetPath, { method: 'DELETE' });
            await loadProgress();
        } finally {
            setResetting(null);
        }
    };

    const genres = [...new Set(CATALOG.map((game) => game.genre))];
    const games = CATALOG.filter((game) => !genre || game.genre === genre);

    return (
        <div className="hub">
            <header className="hub__top">
                <a className="hub__back" href={homeUrl}>
                    ← {t.back_to_app}
                </a>
            </header>

            <section className="hub__hero">
                <span className="hub__hero-emoji" aria-hidden="true">
                    🎮
                </span>
                <div>
                    <h1>{t.games}</h1>
                    <p>{t.subtitle}</p>
                </div>
            </section>

            <div className="hub__filters" role="group">
                <button
                    type="button"
                    className="hub-chip"
                    aria-pressed={genre === null}
                    onClick={() => setGenre(null)}
                >
                    {t.all}
                </button>
                {genres.map((item) => (
                    <button
                        key={item}
                        type="button"
                        className="hub-chip"
                        aria-pressed={genre === item}
                        onClick={() => setGenre(item)}
                    >
                        {t.genres[item]}
                    </button>
                ))}
            </div>

            <div className="hub__grid">
                {games.map((game) => {
                    const [title, description] = t.titles[game.slug] ?? [
                        game.slug,
                        '',
                    ];
                    const playable = Boolean(game.path || game.href);
                    const rated = game.path
                        ? (ratings?.[game.slug] ?? null)
                        : null;
                    const myStars = rated?.mine
                        ? format(t.rate_edit, {
                              stars: plural(t.stars_label, rated.mine.stars),
                          })
                        : t.rate;
                    const played =
                        progress?.[game.slug as keyof Progress] ?? null;
                    const line = played
                        ? format(
                              game.slug === 'city'
                                  ? t.progress_city
                                  : t.progress_epochs,
                              {
                                  year: played.year,
                                  epoch:
                                      typeof played.epoch === 'number'
                                          ? (t.epochs[played.epoch] ?? '')
                                          : (played.epoch_name ?? ''),
                                  population: new Intl.NumberFormat().format(
                                      played.population,
                                  ),
                              },
                          )
                        : null;

                    return (
                        <article
                            key={game.slug}
                            className={`game-card${playable ? '' : ' game-card--soon'}`}
                            style={{ '--hue': game.hue } as CSSProperties}
                        >
                            <div
                                className="game-card__cover"
                                aria-hidden="true"
                            >
                                <span>{game.cover}</span>
                            </div>
                            <div className="game-card__body">
                                <div className="game-card__meta">
                                    <span>{t.genres[game.genre]}</span>
                                    <span
                                        className={`game-card__badge${playable ? ' game-card__badge--new' : ''}`}
                                    >
                                        {playable ? t.new : t.soon}
                                    </span>
                                </div>
                                <h2>{title}</h2>
                                {rated && <RatingLine ratings={rated} />}
                                <p>{description}</p>
                                {line && (
                                    <p className="game-card__progress">
                                        {line}
                                    </p>
                                )}
                            </div>
                            <div className="game-card__foot">
                                {game.path ? (
                                    <>
                                        <Link
                                            className="hub-button"
                                            to={game.path}
                                        >
                                            ▶ {played ? t.continue : t.play}
                                        </Link>
                                        {rated && (
                                            <div className="game-card__actions">
                                                <button
                                                    type="button"
                                                    className="hub-button hub-button--soft"
                                                    aria-label={myStars}
                                                    onClick={() =>
                                                        setDialog({
                                                            kind: 'rate',
                                                            slug: game.slug,
                                                            title,
                                                        })
                                                    }
                                                >
                                                    {rated.mine
                                                        ? `★ ${rated.mine.stars}/5`
                                                        : `☆ ${t.rate}`}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="hub-button hub-button--soft"
                                                    onClick={() =>
                                                        setDialog({
                                                            kind: 'board',
                                                            slug: game.slug,
                                                            title,
                                                        })
                                                    }
                                                >
                                                    🏆 {t.leaderboard}
                                                </button>
                                            </div>
                                        )}
                                        {played && game.resetPath && (
                                            <button
                                                type="button"
                                                className="hub-button hub-button--ghost hub-button--danger"
                                                disabled={
                                                    resetting === game.slug
                                                }
                                                onClick={() =>
                                                    reset(
                                                        game.slug,
                                                        game.resetPath!,
                                                        title,
                                                    )
                                                }
                                                title={t.reset}
                                            >
                                                🗑 {t.reset}
                                            </button>
                                        )}
                                    </>
                                ) : game.href ? (
                                    <a className="hub-button" href={game.href}>
                                        ▶ {t.play}
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        className="hub-button hub-button--ghost"
                                        disabled
                                    >
                                        {t.soon}
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>

            {games.length === 0 && <p className="hub__empty">{t.empty}</p>}

            {dialog?.kind === 'rate' && ratings?.[dialog.slug] && (
                <RateDialog
                    slug={dialog.slug}
                    title={dialog.title}
                    ratings={ratings[dialog.slug]}
                    onSaved={(updated) => updateRatings(dialog.slug, updated)}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === 'board' && (
                <LeaderboardDialog
                    slug={dialog.slug}
                    title={dialog.title}
                    ratings={ratings?.[dialog.slug] ?? null}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
