import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { gameApi } from '../shared/api';
import { format, t } from '../shared/i18n';
import { CATALOG } from './catalog';
import type { Genre } from './catalog';

interface GameProgress {
    epoch: number | string;
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

    useEffect(() => {
        document.title = t.games;
        gameApi<Progress>('progress')
            .then(setProgress)
            .catch(() => setProgress(null));
    }, []);

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
                                          : '',
                                  population: new Intl.NumberFormat().format(
                                      played.population,
                                  ),
                              },
                          )
                        : null;

                    return (
                        <article
                            key={game.slug}
                            className={`game-card${game.path ? '' : ' game-card--soon'}`}
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
                                        className={`game-card__badge${game.path ? ' game-card__badge--new' : ''}`}
                                    >
                                        {game.path ? t.new : t.soon}
                                    </span>
                                </div>
                                <h2>{title}</h2>
                                <p>{description}</p>
                                {line && (
                                    <p className="game-card__progress">
                                        {line}
                                    </p>
                                )}
                            </div>
                            <div className="game-card__foot">
                                {game.path ? (
                                    <Link className="hub-button" to={game.path}>
                                        ▶ {played ? t.continue : t.play}
                                    </Link>
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
        </div>
    );
}
