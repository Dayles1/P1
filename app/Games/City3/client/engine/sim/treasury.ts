/**
 * The treasury's safety nets and the Town Hall's policies (gdd §4.10–
 * §4.12), as pure functions: which building an empty treasury mothballs,
 * how big a loan may be, what the chest holds after a time away, and what
 * a tax or density policy does. None of them can be farmed: the loan costs
 * interest, the chest is at most a year of net once per 25 game years.
 */

import type { TaxPolicy, WorldFile } from '../content/types';

type TreasuryRules = WorldFile['economy']['treasury'];
type PolicyRules = WorldFile['economy']['policies'];

/** What the year-end check knows about a building it may mothball. */
export interface MothballCandidate {
    uid: number;
    /** Money per year it costs while open. */
    upkeep: number;
}

/**
 * At a new year, after a year in arrears that ran at a loss, the open
 * non-home building with the highest upkeep closes (gdd §4.10). Null when
 * nothing is to be closed.
 */
export function mothballPick(
    inArrears: boolean,
    yearNet: number,
    candidates: MothballCandidate[],
): number | null {
    if (!inArrears || yearNet >= 0) {
        return null;
    }

    let best: MothballCandidate | null = null;

    for (const candidate of candidates) {
        if (
            candidate.upkeep > 0 &&
            (!best ||
                candidate.upkeep > best.upkeep ||
                (candidate.upkeep === best.upkeep && candidate.uid < best.uid))
        ) {
            best = candidate;
        }
    }

    return best?.uid ?? null;
}

/** The largest loan the treasury lends: years of gross income. */
export function loanLimit(gross: number, rules: TreasuryRules): number {
    return Math.max(
        0,
        Math.floor(Math.max(0, gross) * rules.loan.maxYearsOfGross),
    );
}

/**
 * The Treasury chest on return (gdd §4.12): `min(1, hoursAway / fill) ×
 * years × net`, only with a positive net and once per `cooldownYears` game
 * years since the last claim (`lastClaim` null = never).
 */
export function chestOffer(
    input: {
        /** Net money per year now. */
        net: number;
        hoursAway: number;
        time: number;
        lastClaim: number | null;
        secondsPerYear: number;
    },
    rules: TreasuryRules,
): number {
    const chest = rules.chest;

    if (
        !(input.net > 0) ||
        !(input.hoursAway > 0) ||
        (input.lastClaim !== null &&
            input.time - input.lastClaim <
                chest.cooldownYears * input.secondsPerYear)
    ) {
        return 0;
    }

    return Math.floor(
        Math.min(1, input.hoursAway / chest.fillRealHours) *
            chest.maxYearsOfNet *
            input.net,
    );
}

/** Game time from which a policy changed at `changedAt` may change again. */
export function policyFreeAt(
    changedAt: number | null,
    rules: PolicyRules,
    secondsPerYear: number,
): number {
    return changedAt === null
        ? 0
        : changedAt + rules.lockYears * secondsPerYear;
}

/** What the city's policies do: a tax multiplier, a happiness term, housing and trips shares. */
export interface PolicyEffects {
    tax: number;
    happiness: number;
    /** Extra housing, a share (0.15 = +15 %). */
    housing: number;
    /** Extra car trips, a share. */
    trips: number;
}

export function policyEffects(
    policy: TaxPolicy,
    dense: boolean,
    rules: PolicyRules,
): PolicyEffects {
    const tax = rules.tax.options[policy] ?? rules.tax.options.normal;

    return {
        tax: tax.tax,
        happiness: tax.happiness + (dense ? rules.dense.happiness : 0),
        housing: dense ? rules.dense.housing : 0,
        trips: dense ? rules.dense.trips : 0,
    };
}
