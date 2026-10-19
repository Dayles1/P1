/**
 * The race against history in numbers (gdd §2.3, ui-spec §5.1): where a
 * year and the city sit on the six-segment race line, and the lead
 * tooltip's sentence.
 */

import type { Game } from '../engine/sim/game';
import { formatExact, formatSigned } from './format';
import { t, word } from './i18n';

/**
 * Where a year sits on the race line: six equal segments, one per era
 * (0→1000, 1000→1500, …, 2000→2100); 6 at the end.
 */
export function racePosition(year: number, history: readonly number[]): number {
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

/** The race line of a game as two shares of its length (0..1). */
export function raceShares(game: Game): { now: number; city: number } {
    const history = game.content.epochs.map((epoch) => epoch.year);
    const segments = history.length - 1;
    const now = racePosition(game.year, history);
    const city = Math.min(segments, game.state.epoch + game.lead().share);

    return { now: now / segments, city: city / segments };
}

/** «★★☆». */
export function starStrip(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
}

/** The lead tooltip (ui-spec §8 `hud.lead.tooltip`), era names in the nominative. */
export function leadText(game: Game): string {
    const lead = game.lead();
    const value = Math.round(lead.lead);
    const next = game.nextEpoch;

    if (value < 0) {
        return t('hud.lead.behind', {
            n: formatExact(-value),
            word: word(-value, 'years'),
        });
    }

    const parts = [
        t('hud.lead.ahead', {
            lead: formatSigned(value),
            word: word(value, 'years'),
        }),
        next
            ? t('hud.lead.like', {
                  year: formatExact(lead.cityYear),
                  era: game.epoch.name,
                  pct: Math.round(lead.share * 100),
                  next: next.name,
              })
            : t('hud.lead.lastEra', { era: game.epoch.name }),
    ];
    const cause = game.leadCause;

    if (cause) {
        parts.push(
            t('hud.lead.cause', {
                cause: cause.label,
                years: formatSigned(cause.years),
                word: word(cause.years, 'years'),
            }),
        );
    }

    if (game.leadFalling()) {
        parts.push(t('hud.lead.falling'));
    }

    return parts.join(' ');
}
