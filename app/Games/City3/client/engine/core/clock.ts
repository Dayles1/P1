/**
 * Game time: one number of game seconds turned into the time of day, the
 * day count, the season and the light, all driven by world.json and
 * climate.json.
 */

import type { Content } from '../content/registry';
import type { SeasonDef } from '../content/types';

export interface Light {
    /** 0 (pitch dark) .. 1 (full daylight). */
    level: number;
    tint: string | null;
    /** How strongly the tint colours the scene, 0..1. */
    tintStrength: number;
    phase: string;
    night: boolean;
}

export class Clock {
    constructor(private content: Content) {}

    get secondsPerDay(): number {
        return this.content.world.time.secondsPerDay;
    }

    /** 0 = midnight, 0.5 = noon. */
    timeOfDay(time: number): number {
        return (time / this.secondsPerDay) % 1;
    }

    day(time: number): number {
        return Math.floor(time / this.secondsPerDay);
    }

    season(time: number): SeasonDef {
        const seasons = this.content.seasons;
        const index =
            Math.floor(
                this.day(time) /
                    Math.max(1, this.content.world.time.daysPerSeason),
            ) % seasons.length;

        return seasons[index];
    }

    /** How far through the current season, 0..1 — used to blend its looks. */
    seasonProgress(time: number): number {
        const length =
            this.secondsPerDay *
            Math.max(1, this.content.world.time.daysPerSeason);

        return (time % length) / length;
    }

    clockText(time: number): string {
        const minutes = Math.floor(this.timeOfDay(time) * 24 * 60);

        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }

    light(time: number, weatherLight = 0): Light {
        const t = this.timeOfDay(time);
        const frames = this.content.bundle.climate.dayNight.keyframes;
        let index = frames.findIndex((frame) => frame.at > t);

        if (index <= 0) {
            index = frames.length - 1;
        }

        const a = frames[index - 1];
        const b = frames[index];
        const f = (t - a.at) / Math.max(0.0001, b.at - a.at);
        const level = Math.max(
            0.1,
            Math.min(1, a.light + (b.light - a.light) * f + weatherLight),
        );
        const tint = f < 0.5 ? (a.tint ?? b.tint) : (b.tint ?? a.tint);
        const tintStrength =
            (a.tint ? 1 - f : 0) * 0.35 + (b.tint ? f : 0) * 0.35;

        return {
            level,
            tint,
            tintStrength,
            phase: f < 0.5 ? a.name : b.name,
            night: level < this.content.bundle.climate.dayNight.nightBelow,
        };
    }
}
