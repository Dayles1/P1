/**
 * The saved state of one player's world. Rules and looks are never here —
 * a building is only its type id, position, level and the player's choices
 * (style, district name and policy); what it costs, gives and looks like
 * comes from the content files.
 */

import type { Amounts } from '../content/types';

export interface Mood {
    until: number;
    amount: number;
    reason: string;
}

export interface Research {
    id: string;
    start: number;
    end: number;
}

/** The columns the player owns, over the land and the beach rows. */
export interface Land {
    minX: number;
    maxX: number;
}

export interface WorldState {
    /** Seeds the events' randomness; the map is the same for everyone. */
    seed: number;
    width: number;
    height: number;
    /** Index into epochs.json. */
    epoch: number;
    /**
     * Game seconds since the world was founded. The calendar year is
     * derived from it (Game.year), so it can never jump.
     */
    time: number;
    land: Land;
    resources: Amounts;
    population: number;
    weather: string;
    weatherUntil: number;
    nextEventAt: number;
    moods: Mood[];
    nextUid: number;
    /** Researched technologies. */
    techs: string[];
    research: Research | null;
    /** Blueprints unlocked in the Architects' Bureau. */
    blueprints: string[];
    /** Goals reached. */
    achievements: string[];
    stats: {
        built: number;
        upgraded: number;
        demolished: number;
        events: number;
    };
}

/** How the player dressed a building: a blueprint and/or own colours. */
export interface BuildingStyle {
    blueprint: string | null;
    colors: Record<string, string>;
}

export interface BuildingState {
    uid: number;
    type: string;
    x: number;
    y: number;
    level: number;
    /** Game time construction (or the last upgrade) started and ends. */
    buildStart: number;
    buildEnd: number;
    style: BuildingStyle | null;
    /**
     * District halls: the district's name. `policy` is v2's and always
     * null now (charters replace it in slice 7); kept for the save shape.
     */
    district: { name: string; policy: string | null } | null;
    /**
     * The city's era when the current level was finished (Heritage).
     * Not saved yet (slice 3): a loaded building counts from its level's era.
     */
    builtEra?: number;
    /** Organic growth progress, 0..1 (gdd §4.7). Not saved yet (slice 3). */
    organic?: number;
}

export type NpcActivity = 'home' | 'walking' | 'working' | 'leisure';

export interface NpcState {
    uid: number;
    type: string;
    name: string;
    age: number;
    homeUid: number;
    workUid: number | null;
    x: number;
    y: number;
    activity: NpcActivity;
    /** Where the current walk leads. */
    goal: 'home' | 'work' | 'leisure' | null;
    /** Personal shift of the daily schedule, in fractions of a day. */
    offset: number;
}

export interface ActionResult {
    ok: boolean;
    reason?: string;
}
