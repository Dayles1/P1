/**
 * Happiness, needs and population (gdd §4.7), as pure functions.
 *
 * A home's happiness has a static part — what its surroundings give it,
 * recomputed only when the map changes — and city terms that are the same
 * for every home (discoveries, events, starving, power at money 0). Homes
 * fill to P* = Σ effective housing × occupancy(happiness); the population
 * moves towards P* every game second. Old homes modernise by themselves
 * once a year (organic growth); the need ladder decides which levels a
 * home may be built or upgraded to at its tile.
 */

import type { NeedDef, ServiceId, WorldFile } from '../content/types';
import { hash2 } from '../core/random';

type HappinessRules = WorldFile['happiness'];
type PopulationRules = WorldFile['population'];

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

/** What a home's surroundings give it; all but `comfort` in happiness points. */
export interface Surroundings {
    /** Share of the unlocked home services that reach the home, 0..1. */
    comfort: number;
    /** Σ auras reaching the home (its own excluded). */
    aura: number;
    /** The Town Hall's aura, if the home is in reach. */
    centerAura: number;
    /** Σ appeal of the metro stations serving the home. */
    transit: number;
    /** Appeal of the best street next to the home. */
    roadAppeal: number;
    pollution: number;
    /** Happiness lost to traffic on the access road (spatial model: slice 6). */
    traffic: number;
    /** Airport noise (slice 11). */
    noise: number;
    /** Green charter bonus (slice 7). */
    charter: number;
}

/** The static part of a home's happiness (not clamped: city terms come on top). */
export function staticHappiness(
    rules: HappinessRules,
    s: Surroundings,
): number {
    return (
        rules.base +
        rules.comfort * s.comfort +
        Math.min(rules.auraCap, s.aura) +
        s.centerAura +
        Math.min(rules.transitCap, s.transit) +
        s.roadAppeal -
        Math.min(rules.pollutionCap, s.pollution) -
        s.traffic -
        s.noise +
        s.charter
    );
}

/** Happiness the whole city shares this tick. */
export interface CityTerms {
    /** Added to every home: discoveries, events, policy, Golden Age, density, starving. */
    all: number;
    /** Added only to homes that use power: −noPower × (1 − power ratio). */
    powered: number;
}

export function cityTerms(
    rules: HappinessRules,
    input: {
        discoveries: number;
        moods: number;
        policy: number;
        golden: number;
        density: number;
        starving: boolean;
        powerRatio: number;
    },
): CityTerms {
    return {
        all:
            input.discoveries +
            input.moods +
            input.policy +
            input.golden +
            input.density -
            (input.starving ? rules.starving : 0),
        powered: -rules.noPower * (1 - clamp(input.powerRatio, 0, 1)),
    };
}

export function homeHappiness(
    staticPart: number,
    powered: boolean,
    terms: CityTerms,
): number {
    return clamp(
        staticPart + terms.all + (powered ? terms.powered : 0),
        0,
        100,
    );
}

/** How full a home is at a happiness: empty at `from`, full at `from + span`. */
export function occupancy(
    happiness: number,
    rules: PopulationRules['occupancy'],
): number {
    return clamp((happiness - rules.from) / rules.span, 0, 1);
}

/** Places a home really offers: fewer when services are missing. */
export function effectiveHousing(
    housing: number,
    comfort: number,
    rules: PopulationRules,
    dense = 1,
): number {
    return (
        housing *
        (rules.comfortFill[0] + rules.comfortFill[1] * comfort) *
        dense
    );
}

/** One home (or the Town Hall's rooms) as the population sees it. */
export interface HomeEntry {
    /** Places (weight of the city's mean happiness). */
    housing: number;
    /** Effective housing (services counted). */
    heff: number;
    staticHappiness: number;
    /** Uses power: suffers the power term. */
    powered: boolean;
}

/**
 * City happiness (housing-weighted mean of the homes) and P* (Σ effective
 * housing × occupancy). Writes each home's happiness into `out` if given.
 */
export function settleHomes(
    homes: readonly HomeEntry[],
    terms: CityTerms,
    rules: PopulationRules,
    fallback: number,
    out?: Float64Array,
): { happiness: number; target: number } {
    let weighted = 0;
    let weight = 0;
    let target = 0;

    homes.forEach((home, index) => {
        const happiness = homeHappiness(
            home.staticHappiness,
            home.powered,
            terms,
        );

        if (out) {
            out[index] = happiness;
        }

        weighted += happiness * home.housing;
        weight += home.housing;
        target += home.heff * occupancy(happiness, rules.occupancy);
    });

    return {
        happiness:
            weight > 0
                ? weighted / weight
                : clamp(fallback + terms.all, 0, 100),
        target,
    };
}

/**
 * One step (dt game seconds) towards P*: above it people move out (at
 * least 0.2 a second, never below P*); while starving 0.4 % leave each
 * second; otherwise homes fill — the faster the happier.
 */
export function growPopulation(
    population: number,
    target: number,
    happiness: number,
    starving: boolean,
    dt: number,
    rules: PopulationRules,
): number {
    let next: number;

    if (population > target) {
        next = Math.max(
            target,
            population -
                Math.max(0.2, (population - target) * rules.moveOutShare) * dt,
        );
    } else if (starving) {
        next = population * Math.pow(1 - rules.starvingDecline, dt);
    } else {
        next = Math.min(
            target,
            population +
                ((target - population) *
                    rules.growthRate *
                    Math.min(1, happiness / 70) +
                    rules.growthFlat) *
                    dt,
        );
    }

    return Number.isFinite(next) ? Math.max(0, next) : 0;
}

/** What the need ladder looks at, at one home's tile. */
export interface NeedContext {
    services: (service: ServiceId) => boolean;
    /** The home's happiness (city terms included). */
    happiness: number;
    /** Σ auras at the tile, the Town Hall's included. */
    aura: number;
    powerRatio: number;
    transit: boolean;
}

export function needMet(need: NeedDef, at: NeedContext): boolean {
    switch (need.need) {
        case 'happiness':
            return at.happiness >= (need.min ?? 0) - 1e-9;
        case 'aura':
            return at.aura >= (need.min ?? 0) - 1e-9;
        case 'power':
            return at.powerRatio >= (need.min ?? 1) - 1e-9;
        case 'transit':
            return at.transit;
        default:
            return at.services(need.need);
    }
}

/** The first `tier` needs of the ladder that are not met at a tile. */
export function missingNeeds(
    needs: readonly NeedDef[],
    tier: number,
    at: NeedContext,
): NeedDef[] {
    return needs
        .slice(0, Math.max(0, tier))
        .filter((need) => !needMet(need, at));
}

/** A home's organic progress before its first year: a stable 0..1 per uid. */
export function organicStart(uid: number): number {
    return hash2(uid, 7919, 41);
}

/** One year of organic growth: +perYear; at 1 the home climbs a level for free. */
export function organicStep(
    progress: number,
    perYear: number,
): { progress: number; climb: boolean } {
    const next = progress + perYear;

    return next >= 1
        ? { progress: next - 1, climb: true }
        : { progress: next, climb: false };
}
