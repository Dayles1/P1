/**
 * The race against history (gdd §2.3, §10), as pure functions: the live
 * lead, the stars of an era entry, the Golden Age that follows it, the
 * 50-year happiness average and the score. The server recomputes the
 * same score from the saved era log (app/Games/City3/WorldStore.php).
 */

import type { WorldFile } from '../content/types';

type ChronicleRules = WorldFile['chronicle'];

/** How far the gate into the next era is (gdd §2.3: g). */
export interface GateProgress {
    population: number;
    populationGate: number;
    /** Gate items complete, and how many there are. */
    items: number;
    itemsTotal: number;
    /** Discoveries of the era made, and how many the gate asks for. */
    discoveries: number;
    discoveriesNeeded: number;
}

/** `g = 0.5 · min(1, P / gate) + 0.5 · done / total`, done = items + min(3, discoveries) / 3. */
export function gateShare(gate: GateProgress): number {
    const population =
        gate.populationGate > 0
            ? Math.min(1, Math.max(0, gate.population) / gate.populationGate)
            : 1;
    const discoveries =
        gate.discoveriesNeeded > 0
            ? Math.min(gate.discoveriesNeeded, gate.discoveries) /
              gate.discoveriesNeeded
            : 1;
    const done = Math.min(gate.items, gate.itemsTotal) + discoveries;

    return 0.5 * population + (0.5 * done) / (gate.itemsTotal + 1);
}

export interface Lead {
    /** Years ahead of history (negative: behind). */
    lead: number;
    /** E(t): the historical year the city is like. */
    cityYear: number;
    /** Share of the way from this era to the next, 0..1 (1 in the last era). */
    share: number;
}

/**
 * Live lead (gdd §2.3): `E(t) = H_e + f · (H_next − H_e)` with f = 0.98
 * while the Town Hall upgrade builds, else 0.95 · g; lead = E − year. In
 * the last era the lead is `H_e − year`.
 */
export function liveLead(
    input: {
        year: number;
        eraYear: number;
        nextEraYear: number | undefined;
        building: boolean;
        gate: GateProgress | null;
    },
    rules: ChronicleRules,
): Lead {
    if (input.nextEraYear === undefined) {
        return {
            lead: input.eraYear - input.year,
            cityYear: input.eraYear,
            share: 1,
        };
    }

    const share = input.building
        ? rules.lead.building
        : rules.lead.progress * (input.gate ? gateShare(input.gate) : 0);
    const cityYear =
        input.eraYear + share * (input.nextEraYear - input.eraYear);

    return { lead: cityYear - input.year, cityYear, share };
}

/**
 * Stars of an era entry (gdd §2.3): ★ by the era's historical year, ★★ by
 * `s2`, ★★★ by `s3` (years from epochs.json entry.stars).
 */
export function starsFor(
    year: number,
    eraYear: number,
    thresholds: [number, number] | undefined,
): number {
    if (year > eraYear) {
        return 0;
    }

    const [two, three] = thresholds ?? [-Infinity, -Infinity];

    return 1 + (year <= two ? 1 : 0) + (year <= three ? 1 : 0);
}

/**
 * Golden Age (gdd §2.3): `perStar × stars` for `years` after the entry,
 * ramping in over the first `rampYears` and out over the last. A share.
 */
export function goldenBonus(
    yearsSince: number,
    stars: number,
    rules: ChronicleRules['golden'],
): number {
    if (!(yearsSince >= 0) || yearsSince > rules.years || stars <= 0) {
        return 0;
    }

    return (
        stars *
        rules.perStar *
        Math.max(
            0,
            Math.min(
                1,
                yearsSince / rules.rampYears,
                (rules.years - yearsSince) / rules.rampYears,
            ),
        )
    );
}

/** Share of the transition to a new era done, 0..1 (sky, accent, clothes, vehicles). */
export function transitionShare(
    yearsSince: number,
    rules: ChronicleRules,
): number {
    return Math.max(0, Math.min(1, yearsSince / rules.transitionYears));
}

/**
 * One step of the happiness moving average (`happinessYears` long) and its
 * best value, counted from that many years on (gdd §10: bestH50).
 */
export function happinessAverage(
    average: { h50: number; bestH50: number },
    happiness: number,
    time: number,
    dt: number,
    secondsPerYear: number,
    rules: ChronicleRules,
): { h50: number; bestH50: number } {
    const span = rules.score.happinessYears * secondsPerYear;
    const h50 =
        average.h50 + ((happiness - average.h50) * Math.min(dt, span)) / span;

    return {
        h50,
        bestH50: time > span ? Math.max(average.bestH50, h50) : average.bestH50,
    };
}

/** One entered era in the Chronicle. */
export interface ChronicleEntry {
    /** Era index (1 = the Middle Ages). */
    era: number;
    /** Calendar year the Town Hall finished. */
    year: number;
    /** H_e − Y_e. */
    lead: number;
    stars: number;
}

export interface Score {
    chronicle: number;
    city: number;
    land: number;
    achievements: number;
    total: number;
}

/**
 * Score (gdd §10) = Chronicle + City + Land + Achievements; money is worth
 * nothing and every term is bounded.
 */
export function scoreOf(
    input: {
        entries: ChronicleEntry[];
        peakPopulation: number;
        bestH50: number;
        strips: number;
        achievements: number;
    },
    rules: ChronicleRules,
): Score {
    const score = rules.score;
    const chronicle = input.entries.reduce(
        (sum, entry) =>
            sum +
            score.eraBase +
            Math.max(0, Math.round(entry.lead)) +
            (score.starPoints[Math.max(0, Math.min(3, entry.stars))] ?? 0),
        0,
    );
    const city = Math.round(
        score.cityPerSqrtPeak *
            Math.sqrt(Math.max(0, input.peakPopulation)) *
            (score.happinessBase +
                (score.happinessShare *
                    Math.max(0, Math.min(100, input.bestH50))) /
                    100),
    );
    const land = score.perStrip * Math.max(0, input.strips);
    const achievements = score.perAchievement * Math.max(0, input.achievements);

    return {
        chronicle,
        city,
        land,
        achievements,
        total: chronicle + city + land + achievements,
    };
}
