/**
 * Moves a world between the engine and the server's tables. A new world is
 * sent whole (every tile with its coordinates); after that only what
 * changed travels: the world's numbers, changed and removed buildings,
 * changed tiles, and the residents.
 *
 * While the game is closed nothing advances (gdd §4.12): there is no
 * catch-up; the Treasury chest is offered on return instead.
 */

import type { Content } from '../content/registry';
import type { Amounts } from '../content/types';
import { defaultEconomy, Game } from '../sim/game';
import type {
    BuildingState,
    BuildingStyle,
    EconomyState,
    EraLogEntry,
    Mood,
    NpcState,
    Research,
    WorldState,
} from '../sim/state';
import { buildMap } from '../world/layout';
import type { TileRow } from '../world/world-map';

export interface WorldPayload {
    seed: number;
    width: number;
    height: number;
    epoch: string;
    epoch_index: number;
    year: number;
    time: number;
    population: number;
    happiness: number;
    score: number;
    resources: Amounts;
    weather: string;
    weather_until: number;
    next_event_at: number;
    moods: Mood[];
    next_uid: number;
    techs: string[];
    research: Research | null;
    blueprints: string[];
    achievements: string[];
    stats: WorldState['stats'];
    peak_population: number;
    era_log: EraLogEntry[];
    economy: EconomyState;
}

export interface BuildingRow {
    uid: number;
    type: string;
    x: number;
    y: number;
    level: number;
    build_start: number;
    build_end: number;
    style: BuildingStyle | null;
    district: BuildingState['district'];
    /** Money paid for it; null in a save from before slice 3. */
    paid: number | null;
    mothballed: boolean;
    organic: number;
    built_era: number | null;
    from_level: number;
}

export interface NpcRow {
    uid: number;
    type: string;
    name: string;
    age: number;
    home_uid: number;
    work_uid: number | null;
    x: number;
    y: number;
    activity: NpcState['activity'];
    offset: number;
}

export interface CreatePayload {
    world: WorldPayload;
    tiles: TileRow[];
    buildings: BuildingRow[];
    npcs: NpcRow[];
}

export interface SyncPayload {
    revision: number;
    world: WorldPayload;
    tiles: TileRow[];
    buildings: { upsert: BuildingRow[]; delete: number[] };
    npcs: NpcRow[];
}

export interface LoadedWorld {
    revision: number;
    saved_at: string | null;
    world: WorldPayload;
    tiles: TileRow[];
    buildings: BuildingRow[];
    npcs: NpcRow[];
}

function worldPayload(game: Game): WorldPayload {
    const s = game.state;

    return {
        seed: s.seed,
        width: s.width,
        height: s.height,
        epoch: game.epoch.id,
        epoch_index: s.epoch,
        // Derived from the time; kept for the server (a 4-digit column).
        year: Math.min(9999, game.year),
        time: Math.floor(s.time),
        population: Math.floor(s.population),
        happiness: Math.round(game.stats.happiness),
        score: game.score(),
        resources: Object.fromEntries(
            Object.entries(s.resources).map(([id, v]) => [
                id,
                Math.round(v * 100) / 100,
            ]),
        ),
        weather: s.weather,
        weather_until: Math.floor(s.weatherUntil),
        next_event_at: Math.floor(s.nextEventAt),
        moods: s.moods,
        next_uid: s.nextUid,
        techs: s.techs,
        research: s.research
            ? {
                  id: s.research.id,
                  start: Math.floor(s.research.start),
                  end: Math.ceil(s.research.end),
              }
            : null,
        blueprints: s.blueprints,
        achievements: s.achievements,
        stats: s.stats,
        peak_population: Math.floor(s.peakPopulation),
        era_log: s.eraLog.map((entry) => ({
            era: entry.era,
            t: Math.floor(entry.t),
        })),
        economy: {
            ...s.economy,
            policyT: roundTime(s.economy.policyT),
            denseT: roundTime(s.economy.denseT),
            chestT: roundTime(s.economy.chestT),
            loan: Math.ceil(s.economy.loan),
            h50: Math.round(s.economy.h50 * 100) / 100,
            bestH50: Math.round(s.economy.bestH50 * 100) / 100,
            flags: { ...s.economy.flags },
        },
    };
}

const roundTime = (t: number | null) => (t === null ? null : Math.floor(t));

const buildingRow = (b: BuildingState): BuildingRow => ({
    uid: b.uid,
    type: b.type,
    x: b.x,
    y: b.y,
    level: b.level,
    build_start: Math.floor(b.buildStart),
    build_end: Math.ceil(b.buildEnd),
    style: b.style,
    district: b.district,
    paid: Math.ceil(b.paid),
    mothballed: b.mothballed,
    organic: Math.round((b.organic ?? 0) * 1000) / 1000,
    built_era: b.builtEra ?? null,
    from_level: b.fromLevel,
});

const npcRow = (n: NpcState): NpcRow => ({
    uid: n.uid,
    type: n.type,
    name: n.name,
    age: n.age,
    home_uid: n.homeUid,
    work_uid: n.workUid,
    x: Math.round(n.x * 100) / 100,
    y: Math.round(n.y * 100) / 100,
    activity: n.activity,
    offset: Math.round(n.offset * 1000) / 1000,
});

export function toCreatePayload(game: Game): CreatePayload {
    game.changedBuildings.clear();
    game.deletedBuildings.clear();
    game.map.dirty.clear();
    game.npcs.takeChanged();

    return {
        world: worldPayload(game),
        tiles: game.map.toRows(),
        buildings: [...game.buildings.values()].map(buildingRow),
        npcs: game.npcs.residents.map(npcRow),
    };
}

/**
 * The changes since the last call. They are taken out of the game; if the
 * request fails, `restoreChanges` puts them back.
 */
export function takeChanges(game: Game, revision: number): SyncPayload {
    const upsert = [...game.changedBuildings]
        .map((uid) => game.buildings.get(uid))
        .filter(Boolean)
        .map((b) => buildingRow(b!));
    const removed = [...game.deletedBuildings];
    const tiles = game.map.toRows(game.map.dirty);

    game.npcs.takeChanged();

    game.changedBuildings.clear();
    game.deletedBuildings.clear();
    game.map.dirty.clear();

    return {
        revision,
        world: worldPayload(game),
        tiles,
        buildings: { upsert, delete: removed },
        // A few dozen rows; sent whole so everyone reloads where they stood.
        npcs: game.npcs.residents.map(npcRow),
    };
}

export function restoreChanges(game: Game, payload: SyncPayload): void {
    for (const row of payload.buildings.upsert) {
        if (game.buildings.has(row.uid)) {
            game.changedBuildings.add(row.uid);
        }
    }

    for (const uid of payload.buildings.delete) {
        game.deletedBuildings.add(uid);
    }

    for (const [x, y] of payload.tiles) {
        game.map.dirty.add(game.map.index(x, y));
    }
}

/**
 * A saved treasury and stores in today's resources: unknown ids (City
 * Chronicle 2's wood, stone, knowledge, …) are dropped, and an older save
 * whose money was called gold keeps it as money.
 */
export function migrateResources(
    content: Content,
    saved: Amounts | null | undefined,
): Amounts {
    const resources = content.emptyAmounts();

    for (const [id, value] of Object.entries(saved ?? {})) {
        if (id in resources && Number.isFinite(value)) {
            resources[id] = Math.max(0, value);
        }
    }

    if (!(content.currency in (saved ?? {})) && Number.isFinite(saved?.gold)) {
        resources[content.currency] = Math.max(0, saved!.gold);
    }

    return resources;
}

export function fromServer(content: Content, loaded: LoadedWorld): Game {
    const w = loaded.world;
    const epochIndex = Math.max(
        0,
        content.epochs.findIndex((e) => e.id === w.epoch),
    );
    const state: WorldState = {
        seed: w.seed,
        width: w.width,
        height: w.height,
        epoch: epochIndex,
        time: w.time,
        land: { ...content.world.map.start },
        resources: migrateResources(content, w.resources),
        population: w.population,
        weather: w.weather,
        weatherUntil: w.weather_until,
        nextEventAt: w.next_event_at,
        moods: w.moods ?? [],
        nextUid: w.next_uid,
        techs: (w.techs ?? []).filter((id) => content.tech(id)),
        research: w.research && content.tech(w.research.id) ? w.research : null,
        blueprints: (w.blueprints ?? []).filter((id) => content.blueprint(id)),
        // Goals and achievements of today's content only (the server checks the ids).
        achievements: (w.achievements ?? []).filter(
            (id) =>
                content.goals.some((goal) => goal.id === id) ||
                content.achievements.some((goal) => goal.id === id),
        ),
        stats: {
            ...{ built: 0, upgraded: 0, demolished: 0, events: 0 },
            ...(w.stats ?? {}),
        },
        eraLog: migrateEraLog(w.era_log, epochIndex, w.time),
        peakPopulation: Math.max(w.peak_population ?? 0, w.population),
        economy: migrateEconomy(w.economy),
    };
    // The map is fixed: built from the content, whatever tiles were saved.
    const map = buildMap(content);

    state.width = map.width;
    state.height = map.height;
    const buildings: BuildingState[] = loaded.buildings.map((b) => {
        const level = Math.max(
            1,
            Math.min(
                content.hasBuilding(b.type)
                    ? content.building(b.type).levels.length
                    : 1,
                b.level,
            ),
        );

        return {
            uid: b.uid,
            type: b.type,
            x: b.x,
            y: b.y,
            level,
            buildStart: b.build_start,
            buildEnd: b.build_end,
            fromLevel: Math.max(0, Math.min(level, b.from_level ?? 0)),
            // Before slice 3 nothing was recorded: the current level's list price.
            paid:
                b.paid ??
                (content.hasBuilding(b.type)
                    ? (content.building(b.type).levels[level - 1]?.cost[
                          content.currency
                      ] ?? 0)
                    : 0),
            mothballed: Boolean(b.mothballed),
            organic: b.organic ?? undefined,
            builtEra: b.built_era ?? undefined,
            style: b.style ?? null,
            district: b.district ?? null,
        };
    });
    const game = new Game(content, state, map, [], []);

    for (const building of buildings) {
        if (content.hasBuilding(building.type)) {
            game.buildings.set(building.uid, building);

            const { w: bw, h: bh } = content.building(building.type).size;

            for (let y = building.y; y < building.y + bh; y++) {
                for (let x = building.x; x < building.x + bw; x++) {
                    if (map.inBounds(x, y)) {
                        map.occupant[map.index(x, y)] = building.uid;
                    }
                }
            }
        }
    }

    game.npcs.residents = loaded.npcs
        .filter((n) => game.buildings.has(n.home_uid))
        .map((n) => ({
            uid: n.uid,
            type: n.type,
            name: n.name,
            age: n.age,
            homeUid: n.home_uid,
            workUid: n.work_uid,
            x: n.x,
            y: n.y,
            activity: n.activity,
            goal:
                n.activity === 'working'
                    ? 'work'
                    : n.activity === 'leisure'
                      ? 'leisure'
                      : 'home',
            offset: n.offset,
        }));
    game.npcs.takeChanged();
    game.structureChanged();

    return game;
}

/**
 * The era log as saved, kept only where it holds together: eras the world
 * has reached, strictly increasing, at non-decreasing times not after now.
 */
export function migrateEraLog(
    saved: EraLogEntry[] | null | undefined,
    epoch: number,
    time: number,
): EraLogEntry[] {
    const log: EraLogEntry[] = [];

    for (const entry of saved ?? []) {
        const last = log.at(-1);

        if (
            Number.isInteger(entry?.era) &&
            Number.isFinite(entry?.t) &&
            entry.era >= 1 &&
            entry.era <= epoch &&
            entry.t <= time &&
            (!last || (entry.era > last.era && entry.t >= last.t))
        ) {
            log.push({ era: entry.era, t: entry.t });
        }
    }

    return log;
}

/** The saved treasury state over the defaults (a save from before slice 3 has none). */
export function migrateEconomy(
    saved: Partial<EconomyState> | null | undefined,
): EconomyState {
    const economy = defaultEconomy();
    const number = (value: unknown, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const time = (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? value : null;

    if (!saved) {
        return economy;
    }

    return {
        policy: ['low', 'normal', 'high'].includes(saved.policy ?? '')
            ? saved.policy!
            : economy.policy,
        policyT: time(saved.policyT),
        dense: Boolean(saved.dense),
        denseT: time(saved.denseT),
        loan: Math.max(0, number(saved.loan, 0)),
        arrears: Boolean(saved.arrears),
        arrearsYears: Math.max(0, number(saved.arrearsYears, 0)),
        chestT: time(saved.chestT),
        h50: number(saved.h50, economy.h50),
        bestH50: number(saved.bestH50, economy.bestH50),
        flags: { tester: Boolean(saved.flags?.tester) },
    };
}

/** Real hours since the world was last saved (the Treasury chest, gdd §4.12). */
export function hoursAway(savedAt: string | null, now = Date.now()): number {
    const saved = savedAt ? Date.parse(savedAt) : NaN;

    return Number.isFinite(saved) ? Math.max(0, (now - saved) / 3_600_000) : 0;
}
