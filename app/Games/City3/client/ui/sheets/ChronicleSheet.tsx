/**
 * «Летопись» (ui-spec §5.2 ChronicleSheet, gdd §2.3, §10): the race line
 * large with the era years under it and the lead sentence, one row per era
 * entered (year, stars, how far ahead of history), the score, and the
 * leaderboard tabs.
 */

import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useGame, useHud } from '../context';
import { formatExact, formatNumber, formatSigned, years } from '../format';
import { RaceLine } from '../hud/CalendarInstrument';
import { t } from '../i18n';
import { Icon } from '../icons/Icon';
import { Segmented } from '../kit/kit';
import { starStrip } from '../race';
import { Section, Sheet } from './Sheet';

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
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [tab]);

    return (
        <Section title={t('chronicle.board')}>
            <Segmented
                label={t('chronicle.board')}
                value={tab}
                onChange={(value) => {
                    setRows(null);
                    setTab(value);
                }}
                options={[
                    { value: 'overall', label: t('chronicle.board.overall') },
                    {
                        value: 'chronicle',
                        label: t('chronicle.board.chronicle'),
                    },
                    { value: 'era', label: t('chronicle.board.era') },
                ]}
            />
            {failed ? (
                <p className="c3-hint">{t('chronicle.boardFailed')}</p>
            ) : !rows ? (
                <p className="c3-hint">{t('chronicle.boardLoading')}</p>
            ) : rows.length === 0 ? (
                <p className="c3-hint">{t('chronicle.boardEmpty')}</p>
            ) : (
                <ol className="c3-board">
                    {rows.map((row) => (
                        <li
                            key={`${row.rank}-${row.name}-${row.score}`}
                            className={row.is_me ? 'is-me' : ''}
                        >
                            <b className="c3-num">{row.rank}</b>
                            <span>
                                {row.name ?? t('chronicle.player')}
                                <small>
                                    {row.details?.epoch_name ?? ''} ·{' '}
                                    {row.details?.year ?? 0}{' '}
                                    {t('hud.calendar.year')} ·{' '}
                                    {formatSigned(row.details?.lead ?? 0)}
                                </small>
                            </span>
                            <span className="c3-saffron">
                                ★ {row.details?.stars ?? 0}
                            </span>
                            <b className="c3-num">{formatNumber(row.score)}</b>
                        </li>
                    ))}
                </ol>
            )}
        </Section>
    );
}

export function ChronicleSheet() {
    const game = useGame();
    const calendar = useHud((s) => s.calendar);
    const entries = game.chronicle();
    const score = game.scoreBreakdown();
    const first = game.content.epochs[1];
    const labels = game.content.epochs.map((epoch, index) =>
        index === 0 ? '0' : String(epoch.year),
    );

    return (
        <Sheet title={t('chronicle.title')} sub={calendar.tooltip}>
            <RaceLine
                now={calendar.raceNow}
                city={calendar.raceCity}
                falling={calendar.falling}
                large
                labels={labels}
            />
            {entries.length === 0 ? (
                <p className="c3-hint">
                    {t('chronicle.first', {
                        era: first?.name ?? '',
                        year: first?.year ?? 0,
                    })}
                </p>
            ) : (
                <ul className="c3-lst">
                    {entries.map((entry) => (
                        <li key={entry.era} className="c3-li c3-li--done">
                            <Icon name="book" />
                            <span>
                                {t('chronicle.entered', {
                                    era: game.content.epoch(entry.era).name,
                                    year: formatExact(entry.year),
                                })}
                                <span className="c3-li__sub">
                                    {entry.lead >= 0
                                        ? t('chronicle.ahead', {
                                              n: years(entry.lead),
                                          })
                                        : t('chronicle.behind', {
                                              n: years(-entry.lead),
                                          })}
                                </span>
                            </span>
                            <span className="c3-saffron c3-stars-text">
                                {starStrip(entry.stars)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <Section title={t('chronicle.score')}>
                <dl className="c3-facts c3-facts--five">
                    {(
                        [
                            ['chronicle.scoreTotal', score.total],
                            ['chronicle.scoreChronicle', score.chronicle],
                            ['chronicle.scoreCity', score.city],
                            ['chronicle.scoreLand', score.land],
                            ['chronicle.scoreAchievements', score.achievements],
                        ] as const
                    ).map(([label, value]) => (
                        <div key={label} className="c3-fact">
                            <dt>{t(label)}</dt>
                            <dd className="c3-num">{formatNumber(value)}</dd>
                        </div>
                    ))}
                </dl>
                <p className="c3-hint">
                    {t('chronicle.scoreNote')}
                    {game.state.economy.flags.tester &&
                        ` ${t('chronicle.tester')}`}
                </p>
            </Section>
            <Leaderboard />
        </Sheet>
    );
}
