/**
 * The saved state of one player's world. Rules and looks are never here —
 * a building is only its type id, position and level; what it costs, gives
 * and looks like comes from the content files.
 */

import type { Amounts } from '../content/types';

export interface Mood {
    until: number;
    amount: number;
    reason: string;
}

export interface WorldState {
    seed: number;
    width: number;
    height: number;
    /** Index into epochs.json. */
    epoch: number;
    year: number;
    /** Game seconds since the world was founded. */
    time: number;
    resources: Amounts;
    population: number;
    weather: string;
    weatherUntil: number;
    nextEventAt: number;
    moods: Mood[];
    nextUid: number;
    stats: {
        built: number;
        upgraded: number;
        demolished: number;
        events: number;
    };
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
