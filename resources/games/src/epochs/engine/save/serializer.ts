/**
 * Moves a world between the engine and the server's tables. A new world is
 * sent whole (every tile with its coordinates); after that only what
 * changed travels: the world's numbers, changed and removed buildings,
 * changed tiles, and the residents.
 */

import type { Content } from '../content/registry';
import type { Amounts } from '../content/types';
import { Game } from '../sim/game';
import type { BuildingState, Mood, NpcState, WorldState } from '../sim/state';
import { WorldMap } from '../world/world-map';
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
    stats: WorldState['stats'];
}

export interface BuildingRow {
    uid: number;
    type: string;
    x: number;
    y: number;
    level: number;
    build_start: number;
    build_end: number;
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
        year: Math.floor(s.year),
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
        stats: s.stats,
    };
}

const buildingRow = (b: BuildingState): BuildingRow => ({
    uid: b.uid,
    type: b.type,
    x: b.x,
    y: b.y,
    level: b.level,
    build_start: Math.floor(b.buildStart),
    build_end: Math.ceil(b.buildEnd),
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
        year: w.year,
        time: w.time,
        resources: { ...content.emptyAmounts(), ...w.resources },
        population: w.population,
        weather: w.weather,
        weatherUntil: w.weather_until,
        nextEventAt: w.next_event_at,
        moods: w.moods ?? [],
        nextUid: w.next_uid,
        stats: {
            ...{ built: 0, upgraded: 0, demolished: 0, events: 0 },
            ...(w.stats ?? {}),
        },
    };
    const map = WorldMap.fromRows(content, w.width, w.height, loaded.tiles);
    const buildings: BuildingState[] = loaded.buildings.map((b) => ({
        uid: b.uid,
        type: b.type,
        x: b.x,
        y: b.y,
        level: Math.max(
            1,
            Math.min(
                content.hasBuilding(b.type)
                    ? content.building(b.type).levels.length
                    : 1,
                b.level,
            ),
        ),
        buildStart: b.build_start,
        buildEnd: b.build_end,
    }));
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

/** Plays out the time the player was away (capped by world.json). */
export function catchUp(
    game: Game,
    savedAt: string | null,
): { seconds: number; population: number; gold: number } | null {
    if (!savedAt) {
        return null;
    }

    const seconds = Math.min(
        game.content.world.time.maxOfflineSeconds,
        Math.floor((Date.now() - Date.parse(savedAt)) / 1000),
    );

    if (seconds < 30) {
        return null;
    }

    const before = {
        population: game.state.population,
        gold: game.state.resources.gold ?? 0,
    };

    for (let i = 0; i < seconds; i++) {
        game.tick(1, true);
    }

    return {
        seconds,
        population: Math.floor(game.state.population - before.population),
        gold: Math.floor((game.state.resources.gold ?? 0) - before.gold),
    };
}
