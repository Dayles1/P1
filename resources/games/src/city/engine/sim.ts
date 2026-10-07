/**
 * The city simulation. `City` owns the saved state (plain JSON, see
 * CityState) plus everything derived from it — which tile holds what,
 * which buildings reach the centre by road, how happy each home is — and
 * advances it one game second at a time. It knows nothing about canvas or
 * React; the UI reads it and calls its actions.
 */

import {
    BUILDING,
    EPOCHS,
    epochYearEnd,
    GOALS,
    RESOURCES,
    TECH,
    TECHS,
    buildingName,
} from './data';
import type { BuildingDef, Cost, Resource } from './data';
import {
    CENTER,
    FOREST,
    GRASS,
    MAP_SIZE,
    ROCK,
    TERRAIN_CODE,
    WATER,
    generateTerrain,
    inMap,
    mulberry32,
} from './map';

export const SAVE_VERSION = 1;

/** Game seconds per in-game year. */
const SECONDS_PER_YEAR = 5;

/** Each resident eats this much food per second. */
const FOOD_PER_PERSON = 0.04;

/** Share of residents who work. */
const WORKFORCE = 0.6;

/** Each era makes farms, lumber camps and quarries this much more productive. */
const ERA_PRODUCTIVITY = 0.2;

/** Longest stretch simulated for the time the player was away. */
const OFFLINE_CAP_SECONDS = 3600;

export interface Building {
    id: number;
    type: string;
    x: number;
    y: number;
    level: number;
    /** Game time construction or an upgrade finishes; until then it does not work. */
    buildEnd: number;
    buildStart: number;
}

export interface Mood {
    until: number;
    amount: number;
    reason: string;
}

export interface HistoryPoint {
    t: number;
    population: number;
    gold: number;
    happiness: number;
}

export interface CityState {
    version: number;
    seed: number;
    time: number;
    year: number;
    epoch: number;
    res: Record<Resource, number>;
    population: number;
    buildings: Building[];
    nextId: number;
    cleared: number[];
    techs: string[];
    goal: number;
    history: HistoryPoint[];
    nextEventAt: number;
    moods: Mood[];
    stats: {
        built: number;
        upgraded: number;
        raidsWon: number;
        raidsLost: number;
        researched: number;
    };
    savedAt: number;
}

export type CityEvent =
    | { type: 'toast'; text: string; tone: 'info' | 'good' | 'bad' }
    | {
          type: 'fx';
          kind: 'build' | 'upgrade' | 'demolish' | 'done';
          x: number;
          y: number;
          size: number;
      }
    | { type: 'float'; text: string; x: number; y: number; color: string }
    | { type: 'epoch'; epoch: number }
    | { type: 'goal'; text: string };

export interface ActionResult {
    ok: boolean;
    reason?: string;
}

/** What one building is doing right now — the selection panel shows it. */
export interface BuildingStatus {
    connected: boolean;
    building: boolean;
    efficiency: number;
    starved: Resource | null;
    noPower: boolean;
    nearbyTiles: number;
    boost: number;
    happiness: number | null;
    residents: number;
    output: Cost;
    input: Cost;
}

export const levelOutput = (level: number) => 1 + 0.75 * (level - 1);
export const levelWorkers = (level: number) => 1 + 0.5 * (level - 1);
export const levelHousing = (level: number) => 1 + 0.8 * (level - 1);
export const levelAura = (level: number) => 1 + 0.3 * (level - 1);
export const levelPower = (level: number) => 1 + 0.6 * (level - 1);

function emptyRes(): Record<Resource, number> {
    return { food: 0, wood: 0, stone: 0, gold: 0, science: 0 };
}

export function formatCost(cost: Cost): string {
    return RESOURCES.filter((r) => cost[r.id])
        .map((r) => `${r.icon} ${Math.ceil(cost[r.id] ?? 0)}`)
        .join('  ');
}

export class City {
    state: CityState;
    terrain: Uint8Array;
    /** Building id per tile, 0 for none. */
    grid: Int32Array;
    byId = new Map<number, Building>();
    status = new Map<number, BuildingStatus>();
    connectedRoads = new Set<number>();

    rates: Record<Resource, number> = emptyRes();
    caps: Record<Resource, number> = emptyRes();
    housingCapacity = 0;
    jobs = 0;
    workers = 0;
    employment = 1;
    powerSupply = 0;
    powerDemand = 0;
    happiness = 50;
    defense = 0;
    starving = false;

    /** Raised by every change the UI or the renderer has to notice. */
    revision = 0;
    events: CityEvent[] = [];

    private structureDirty = true;
    private random: () => number;

    constructor(state: CityState) {
        this.state = state;
        this.terrain = generateTerrain(state.seed);

        for (const index of state.cleared) {
            this.terrain[index] = GRASS;
        }

        this.grid = new Int32Array(MAP_SIZE * MAP_SIZE);
        this.random = mulberry32(state.seed ^ Math.floor(state.time * 1000));
        this.recalculate();
        this.updateEconomy(0);
    }

    static create(seed = Math.floor(Math.random() * 2 ** 31)): City {
        const state: CityState = {
            version: SAVE_VERSION,
            seed,
            time: 0,
            year: EPOCHS[0].year,
            epoch: 0,
            res: { food: 80, wood: 140, stone: 40, gold: 50, science: 0 },
            population: 5,
            buildings: [
                {
                    id: 1,
                    type: 'center',
                    x: CENTER,
                    y: CENTER,
                    level: 1,
                    buildEnd: 0,
                    buildStart: 0,
                },
            ],
            nextId: 2,
            cleared: [],
            techs: [],
            goal: 0,
            history: [],
            nextEventAt: 180,
            moods: [],
            stats: {
                built: 0,
                upgraded: 0,
                raidsWon: 0,
                raidsLost: 0,
                researched: 0,
            },
            savedAt: Date.now(),
        };

        return new City(state);
    }

    /**
     * Restores a save and plays out (up to an hour of) the time the player
     * was away. Answers the city and what changed meanwhile.
     */
    static load(state: CityState): {
        city: City;
        away: { seconds: number; population: number; gold: number } | null;
    } {
        const city = new City(state);
        const seconds = Math.min(
            OFFLINE_CAP_SECONDS,
            Math.floor((Date.now() - (state.savedAt || Date.now())) / 1000),
        );

        if (seconds < 30) {
            return { city, away: null };
        }

        const before = {
            population: city.state.population,
            gold: city.state.res.gold,
        };

        for (let i = 0; i < seconds; i++) {
            city.tick(1, true);
        }

        city.events = [];

        return {
            city,
            away: {
                seconds,
                population: Math.floor(
                    city.state.population - before.population,
                ),
                gold: Math.floor(city.state.res.gold - before.gold),
            },
        };
    }

    // ——————————————————————————————————————————————— Queries

    def(building: Building): BuildingDef {
        return BUILDING[building.type];
    }

    nameOf(building: Building): string {
        return buildingName(this.def(building), this.state.epoch);
    }

    terrainAt(x: number, y: number): number {
        return inMap(x, y) ? this.terrain[y * MAP_SIZE + x] : WATER;
    }

    buildingAt(x: number, y: number): Building | null {
        if (!inMap(x, y)) {
            return null;
        }

        return this.byId.get(this.grid[y * MAP_SIZE + x]) ?? null;
    }

    territory(epoch = this.state.epoch): { min: number; max: number } {
        const radius = EPOCHS[epoch].territory;

        return {
            min: Math.max(0, CENTER - radius),
            max: Math.min(MAP_SIZE - 1, CENTER + 1 + radius),
        };
    }

    inTerritory(x: number, y: number): boolean {
        const { min, max } = this.territory();

        return x >= min && y >= min && x <= max && y <= max;
    }

    isComplete(building: Building): boolean {
        return building.buildEnd <= this.state.time;
    }

    count(type: string): number {
        return this.state.buildings.filter((b) => b.type === type).length;
    }

    hasTech(id: string): boolean {
        return this.state.techs.includes(id);
    }

    techBonus(key: Resource | 'housing' | 'happiness'): number {
        return this.state.techs.reduce(
            (sum, id) => sum + (TECH[id]?.bonus?.[key] ?? 0),
            0,
        );
    }

    /** Why a building type cannot be built yet, or null when it can. */
    lockReason(def: BuildingDef): string | null {
        if (def.hidden) {
            return 'Нельзя построить';
        }

        if (this.state.epoch < def.epoch) {
            return `Эпоха «${EPOCHS[def.epoch].name}»`;
        }

        if (def.tech && !this.hasTech(def.tech)) {
            return `Технология «${TECH[def.tech].name}»`;
        }

        if (def.unique && this.count(def.id) > 0) {
            return 'Уже построено';
        }

        return null;
    }

    buildCost(def: BuildingDef): Cost {
        if (def.id !== 'road') {
            return def.cost;
        }

        if (this.state.epoch < 2) {
            return { wood: 2 };
        }

        return this.state.epoch < 6 ? { stone: 3 } : { stone: 4, gold: 2 };
    }

    upgradeCost(building: Building): Cost {
        const def = this.def(building);
        const factor = 1 + building.level * 0.9;
        const cost: Cost = {};

        for (const [resource, amount] of Object.entries(def.cost) as [
            Resource,
            number,
        ][]) {
            cost[resource] = Math.ceil(amount * factor);
        }

        if (!def.cost.stone) {
            cost.stone = Math.ceil(
                (def.cost.wood ?? 20) * 0.4 * building.level,
            );
        }

        return cost;
    }

    upgradeBlock(building: Building): string | null {
        const def = this.def(building);

        if (building.level >= def.maxLevel) {
            return 'Максимальный уровень';
        }

        if (!this.isComplete(building)) {
            return 'Идёт стройка';
        }

        if (building.level >= 2 && this.state.epoch < def.epoch + 1) {
            return `Уровень 3 — в эпоху «${EPOCHS[Math.min(def.epoch + 1, EPOCHS.length - 1)].name}»`;
        }

        return null;
    }

    moveCost(building: Building): Cost {
        return {
            gold: Math.ceil(
                8 * this.def(building).size * (this.state.epoch + 1),
            ),
        };
    }

    canAfford(cost: Cost): boolean {
        return (Object.entries(cost) as [Resource, number][]).every(
            ([r, amount]) => this.state.res[r] >= amount - 1e-6,
        );
    }

    missing(cost: Cost): string {
        const parts = (Object.entries(cost) as [Resource, number][])
            .filter(([r, amount]) => this.state.res[r] < amount)
            .map(([r]) =>
                RESOURCES.find((res) => res.id === r)!.name.toLowerCase(),
            );

        return parts.length ? `Не хватает: ${parts.join(', ')}` : '';
    }

    /** Tiles within `radius` of a footprint (Chebyshev distance), footprint excluded. */
    *around(
        x: number,
        y: number,
        size: number,
        radius: number,
    ): Generator<[number, number]> {
        for (let ty = y - radius; ty < y + size + radius; ty++) {
            for (let tx = x - radius; tx < x + size + radius; tx++) {
                if (
                    inMap(tx, ty) &&
                    !(tx >= x && tx < x + size && ty >= y && ty < y + size)
                ) {
                    yield [tx, ty];
                }
            }
        }
    }

    countTerrainNear(
        x: number,
        y: number,
        size: number,
        radius: number,
        code: number,
    ): number {
        let count = 0;

        for (const [tx, ty] of this.around(x, y, size, radius)) {
            count += this.terrainAt(tx, ty) === code ? 1 : 0;
        }

        return count;
    }

    canPlace(type: string, x: number, y: number, ignoreId = 0): ActionResult {
        const def = BUILDING[type];

        for (let ty = y; ty < y + def.size; ty++) {
            for (let tx = x; tx < x + def.size; tx++) {
                if (!inMap(tx, ty) || !this.inTerritory(tx, ty)) {
                    return { ok: false, reason: 'За границей ваших земель' };
                }

                const terrain = this.terrainAt(tx, ty);

                if (terrain === WATER) {
                    return { ok: false, reason: 'Здесь вода' };
                }

                if (terrain !== GRASS) {
                    return {
                        ok: false,
                        reason: 'Сначала расчистите лес или скалы',
                    };
                }

                const occupant = this.grid[ty * MAP_SIZE + tx];

                if (occupant && occupant !== ignoreId) {
                    return { ok: false, reason: 'Место занято' };
                }
            }
        }

        if (def.nearby?.required) {
            const radius = def.nearby.terrain === 'water' ? 1 : 2;

            if (
                !this.countTerrainNear(
                    x,
                    y,
                    def.size,
                    radius,
                    TERRAIN_CODE[def.nearby.terrain],
                )
            ) {
                return {
                    ok: false,
                    reason:
                        def.nearby.terrain === 'water'
                            ? 'Нужна вода рядом'
                            : 'Нужны скалы рядом',
                };
            }
        }

        return { ok: true };
    }

    // ——————————————————————————————————————————————— Actions

    place(type: string, x: number, y: number): ActionResult {
        const def = BUILDING[type];
        const locked = this.lockReason(def);

        if (locked) {
            return { ok: false, reason: locked };
        }

        const placement = this.canPlace(type, x, y);

        if (!placement.ok) {
            return placement;
        }

        const cost = this.buildCost(def);

        if (!this.canAfford(cost)) {
            return { ok: false, reason: this.missing(cost) };
        }

        this.pay(cost);

        const duration = type === 'road' ? 0 : 2 + def.size * 1.5;
        const building: Building = {
            id: this.state.nextId++,
            type,
            x,
            y,
            level: 1,
            buildStart: this.state.time,
            buildEnd: this.state.time + duration,
        };

        this.state.buildings.push(building);
        this.state.stats.built += type === 'road' ? 0 : 1;
        this.structureChanged();

        if (type !== 'road') {
            this.events.push({
                type: 'fx',
                kind: 'build',
                x,
                y,
                size: def.size,
            });
        }

        return { ok: true };
    }

    upgrade(id: number): ActionResult {
        const building = this.byId.get(id);

        if (!building) {
            return { ok: false };
        }

        const blocked = this.upgradeBlock(building);

        if (blocked) {
            return { ok: false, reason: blocked };
        }

        const cost = this.upgradeCost(building);

        if (!this.canAfford(cost)) {
            return { ok: false, reason: this.missing(cost) };
        }

        this.pay(cost);
        building.level++;
        building.buildStart = this.state.time;
        building.buildEnd = this.state.time + 3 + building.level * 2;
        this.state.stats.upgraded++;
        this.structureChanged();
        this.events.push({
            type: 'fx',
            kind: 'upgrade',
            x: building.x,
            y: building.y,
            size: this.def(building).size,
        });

        return { ok: true };
    }

    demolish(id: number): ActionResult {
        const building = this.byId.get(id);

        if (!building || building.type === 'center') {
            return { ok: false, reason: 'Центр города снести нельзя' };
        }

        const def = this.def(building);
        const refund = this.buildCost(def);

        for (const [resource, amount] of Object.entries(refund) as [
            Resource,
            number,
        ][]) {
            this.state.res[resource] += Math.floor(amount * 0.5);
        }

        this.state.buildings = this.state.buildings.filter((b) => b.id !== id);
        this.structureChanged();
        this.events.push({
            type: 'fx',
            kind: 'demolish',
            x: building.x,
            y: building.y,
            size: def.size,
        });

        return { ok: true };
    }

    move(id: number, x: number, y: number): ActionResult {
        const building = this.byId.get(id);

        if (!building || building.type === 'center') {
            return { ok: false, reason: 'Это здание нельзя перенести' };
        }

        if (building.x === x && building.y === y) {
            return { ok: true };
        }

        const placement = this.canPlace(building.type, x, y, id);

        if (!placement.ok) {
            return placement;
        }

        const cost = this.moveCost(building);

        if (!this.canAfford(cost)) {
            return { ok: false, reason: this.missing(cost) };
        }

        this.pay(cost);
        building.x = x;
        building.y = y;
        building.buildStart = this.state.time;
        building.buildEnd = this.state.time + 2;
        this.structureChanged();
        this.events.push({
            type: 'fx',
            kind: 'build',
            x,
            y,
            size: this.def(building).size,
        });

        return { ok: true };
    }

    /** Cuts a forest tile for wood or breaks a rock for stone. */
    clearTile(x: number, y: number): ActionResult {
        const terrain = this.terrainAt(x, y);

        if (!this.inTerritory(x, y)) {
            return { ok: false, reason: 'За границей ваших земель' };
        }

        if (terrain !== FOREST && terrain !== ROCK) {
            return { ok: false, reason: 'Здесь нечего расчищать' };
        }

        const cost: Cost = terrain === FOREST ? { gold: 3 } : { gold: 10 };

        if (!this.canAfford(cost)) {
            return { ok: false, reason: this.missing(cost) };
        }

        this.pay(cost);

        const index = y * MAP_SIZE + x;

        this.terrain[index] = GRASS;
        this.state.cleared.push(index);

        if (terrain === FOREST) {
            this.gain({ wood: 8 });
            this.events.push({
                type: 'float',
                text: '+8 🌲',
                x: x + 0.5,
                y: y + 0.5,
                color: '#f2c46d',
            });
        } else {
            this.gain({ stone: 10 });
            this.events.push({
                type: 'float',
                text: '+10 🧱',
                x: x + 0.5,
                y: y + 0.5,
                color: '#d9dde3',
            });
        }

        this.events.push({ type: 'fx', kind: 'demolish', x, y, size: 1 });
        this.structureChanged();

        return { ok: true };
    }

    techState(id: string): 'done' | 'available' | 'locked' {
        const tech = TECH[id];

        if (this.hasTech(id)) {
            return 'done';
        }

        if (
            tech.epoch > this.state.epoch ||
            (tech.requires ?? []).some((r) => !this.hasTech(r))
        ) {
            return 'locked';
        }

        return 'available';
    }

    research(id: string): ActionResult {
        const tech = TECH[id];

        if (this.techState(id) !== 'available') {
            return { ok: false, reason: 'Пока недоступно' };
        }

        if (this.state.res.science < tech.cost) {
            return { ok: false, reason: 'Не хватает знаний' };
        }

        this.state.res.science -= tech.cost;
        this.state.techs.push(id);
        this.state.stats.researched++;
        this.structureChanged();
        this.events.push({
            type: 'toast',
            text: `${tech.icon} Изучено: ${tech.name}`,
            tone: 'good',
        });

        return { ok: true };
    }

    epochChecklist(): { label: string; done: boolean }[] {
        const next = EPOCHS[this.state.epoch].next;

        if (!next) {
            return [];
        }

        return [
            {
                label: `Жителей: ${Math.floor(this.state.population)} / ${next.population}`,
                done: this.state.population >= next.population,
            },
            {
                label: `Технология «${TECH[next.tech].name}»`,
                done: this.hasTech(next.tech),
            },
            {
                label: `Казна: ${formatCost(next.cost)}`,
                done: this.canAfford(next.cost),
            },
        ];
    }

    canAdvance(): boolean {
        const checklist = this.epochChecklist();

        return checklist.length > 0 && checklist.every((item) => item.done);
    }

    advanceEpoch(): ActionResult {
        const next = EPOCHS[this.state.epoch].next;

        if (!next || !this.canAdvance()) {
            return { ok: false, reason: 'Условия ещё не выполнены' };
        }

        this.pay(next.cost);
        this.state.epoch++;
        this.state.year = EPOCHS[this.state.epoch].year;
        this.structureChanged();
        this.events.push({ type: 'epoch', epoch: this.state.epoch });

        return { ok: true };
    }

    // ——————————————————————————————————————————————— Simulation

    /** Advances the city by `dt` game seconds. */
    tick(dt = 1, quiet = false): void {
        const state = this.state;

        state.time += dt;
        state.year = Math.min(
            epochYearEnd(state.epoch) - 1,
            state.year + dt / SECONDS_PER_YEAR,
        );
        state.moods = state.moods.filter((mood) => mood.until > state.time);

        for (const building of state.buildings) {
            if (
                building.buildEnd > state.time - dt &&
                building.buildEnd <= state.time
            ) {
                this.structureDirty = true;

                if (!quiet && building.type !== 'road') {
                    this.events.push({
                        type: 'fx',
                        kind: 'done',
                        x: building.x,
                        y: building.y,
                        size: this.def(building).size,
                    });
                }
            }
        }

        if (this.structureDirty) {
            this.recalculate();
        }

        this.updateEconomy(dt);
        this.updatePopulation(dt);

        if (!quiet && state.time >= state.nextEventAt) {
            this.randomEvent();
        } else if (quiet && state.time >= state.nextEventAt) {
            state.nextEventAt = state.time + 120;
        }

        if (Math.floor(state.time) % 10 === 0) {
            state.history.push({
                t: Math.floor(state.time),
                population: Math.floor(state.population),
                gold: Math.floor(state.res.gold),
                happiness: Math.round(this.happiness),
            });

            if (state.history.length > 120) {
                state.history.shift();
            }
        }

        this.checkGoals(quiet);
        this.revision++;
    }

    score(): number {
        const levels = this.state.buildings.reduce(
            (sum, b) => sum + (b.type === 'road' ? 0 : b.level),
            0,
        );

        return Math.floor(
            this.state.population +
                levels * 10 +
                this.state.techs.length * 25 +
                this.state.epoch * 500,
        );
    }

    // ——————————————————————————————————————————————— Internals

    private pay(cost: Cost): void {
        for (const [resource, amount] of Object.entries(cost) as [
            Resource,
            number,
        ][]) {
            this.state.res[resource] = Math.max(
                0,
                this.state.res[resource] - amount,
            );
        }

        this.revision++;
    }

    private gain(cost: Cost): void {
        for (const [resource, amount] of Object.entries(cost) as [
            Resource,
            number,
        ][]) {
            this.state.res[resource] += amount;
        }

        this.clampToCaps();
    }

    private structureChanged(): void {
        this.structureDirty = true;
        this.recalculate();
        this.updateEconomy(0);
        this.checkGoals(false);
        this.revision++;
    }

    /**
     * Everything that only changes when something is built, moved,
     * upgraded or researched: the tile grid, road connections, terrain
     * and mill bonuses, and how much each home enjoys its surroundings.
     */
    private recalculate(): void {
        this.structureDirty = false;
        this.grid.fill(0);
        this.byId.clear();

        for (const building of this.state.buildings) {
            const size = BUILDING[building.type].size;

            this.byId.set(building.id, building);

            for (let ty = building.y; ty < building.y + size; ty++) {
                for (let tx = building.x; tx < building.x + size; tx++) {
                    this.grid[ty * MAP_SIZE + tx] = building.id;
                }
            }
        }

        this.findConnectedRoads();

        const working = this.state.buildings.filter(
            (b) => this.isComplete(b) && this.isConnected(b),
        );
        const status = new Map<number, BuildingStatus>();

        for (const building of this.state.buildings) {
            const def = this.def(building);
            let nearbyTiles = 0;
            let boost = 0;
            let happiness: number | null = null;

            if (def.nearby) {
                nearbyTiles = this.countTerrainNear(
                    building.x,
                    building.y,
                    def.size,
                    2,
                    TERRAIN_CODE[def.nearby.terrain],
                );
            }

            for (const other of working) {
                const otherDef = this.def(other);

                if (
                    otherDef.boost?.targets.includes(def.id) &&
                    this.distance(building, other) <= otherDef.boost.radius
                ) {
                    boost +=
                        (otherDef.boost.percent * levelAura(other.level)) / 100;
                }
            }

            if (def.housing && def.id !== 'center') {
                let services = 0;
                let pollution = 0;

                for (const other of working) {
                    const otherDef = this.def(other);
                    const distance = this.distance(building, other);

                    if (
                        other.id !== building.id &&
                        otherDef.aura &&
                        distance <= otherDef.aura.radius
                    ) {
                        services +=
                            otherDef.aura.happiness * levelAura(other.level);
                    }

                    if (
                        otherDef.pollution &&
                        distance <= otherDef.pollution.radius
                    ) {
                        pollution += otherDef.pollution.amount;
                    }
                }

                happiness = 40 + Math.min(services, 55) - pollution;
            }

            status.set(building.id, {
                connected: this.isConnected(building),
                building: !this.isComplete(building),
                efficiency: 0,
                starved: null,
                noPower: false,
                nearbyTiles,
                boost,
                happiness,
                residents: 0,
                output: {},
                input: {},
            });
        }

        this.status = status;
    }

    /** Gap in tiles between two footprints (0 when touching). */
    distance(a: Building, b: Building): number {
        const sa = BUILDING[a.type].size;
        const sb = BUILDING[b.type].size;
        const dx = Math.max(0, a.x - (b.x + sb - 1), b.x - (a.x + sa - 1));
        const dy = Math.max(0, a.y - (b.y + sb - 1), b.y - (a.y + sa - 1));

        return Math.max(dx, dy);
    }

    private findConnectedRoads(): void {
        const connected = new Set<number>();
        const queue: number[] = [];
        const center = this.state.buildings.find((b) => b.type === 'center');

        if (center) {
            for (const [x, y] of this.around(center.x, center.y, 2, 1)) {
                const diagonal =
                    (x === center.x - 1 || x === center.x + 2) &&
                    (y === center.y - 1 || y === center.y + 2);

                if (diagonal) {
                    continue;
                }

                const index = y * MAP_SIZE + x;

                if (this.byId.get(this.grid[index])?.type === 'road') {
                    connected.add(index);
                    queue.push(index);
                }
            }
        }

        while (queue.length) {
            const index = queue.pop()!;
            const x = index % MAP_SIZE;
            const y = Math.floor(index / MAP_SIZE);

            for (const [nx, ny] of [
                [x + 1, y],
                [x - 1, y],
                [x, y + 1],
                [x, y - 1],
            ]) {
                const next = ny * MAP_SIZE + nx;

                if (
                    inMap(nx, ny) &&
                    !connected.has(next) &&
                    this.byId.get(this.grid[next])?.type === 'road'
                ) {
                    connected.add(next);
                    queue.push(next);
                }
            }
        }

        this.connectedRoads = connected;
    }

    isConnected(building: Building): boolean {
        const def = this.def(building);

        if (def.noRoad) {
            return (
                def.id !== 'road' ||
                this.connectedRoads.has(building.y * MAP_SIZE + building.x)
            );
        }

        for (let i = 0; i < def.size; i++) {
            for (const [x, y] of [
                [building.x + i, building.y - 1],
                [building.x + i, building.y + def.size],
                [building.x - 1, building.y + i],
                [building.x + def.size, building.y + i],
            ]) {
                if (!inMap(x, y)) {
                    continue;
                }

                const index = y * MAP_SIZE + x;
                const neighbour = this.byId.get(this.grid[index]);

                if (
                    this.connectedRoads.has(index) ||
                    neighbour?.type === 'center'
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private updateEconomy(dt: number): void {
        const state = this.state;
        const epoch = state.epoch;
        const housingBonus = 1 + this.techBonus('housing') / 100;
        const caps = emptyRes();
        const rates = emptyRes();
        let housing = 0;
        let jobs = 0;
        let powerSupply = 0;
        let powerDemand = 0;
        let defense = 0;

        caps.gold = Infinity;
        caps.science = Infinity;

        const working: Building[] = [];

        for (const building of state.buildings) {
            const def = this.def(building);
            const status = this.status.get(building.id);

            if (!status) {
                continue;
            }

            status.building = !this.isComplete(building);
            status.efficiency = 0;
            status.output = {};
            status.input = {};
            status.starved = null;
            status.noPower = false;

            if (status.building || !status.connected) {
                continue;
            }

            working.push(building);

            const centerScale = def.id === 'center' ? 1 + epoch : 1;

            if (def.housing) {
                housing +=
                    (def.id === 'center'
                        ? def.housing + 6 * epoch
                        : def.housing * levelHousing(building.level)) *
                    housingBonus;
            }

            if (def.storage) {
                const storage =
                    def.id === 'center'
                        ? def.storage + 250 * epoch
                        : def.storage * building.level * (1 + epoch * 0.5);

                caps.food += storage;
                caps.wood += storage;
                caps.stone += storage;
            }

            jobs += (def.workers ?? 0) * levelWorkers(building.level);
            powerSupply += (def.power ?? 0) * levelPower(building.level);
            powerDemand += (def.powerUse ?? 0) * levelWorkers(building.level);
            defense +=
                (def.defense ?? 0) * levelPower(building.level) * centerScale;
        }

        caps.food += 200;
        caps.wood += 200;
        caps.stone += 200;

        const workers = state.population * WORKFORCE;
        const employment = jobs > 0 ? Math.min(1, workers / jobs) : 1;
        const powerRatio =
            powerDemand > 0 ? Math.min(1, powerSupply / powerDemand) : 1;
        const globalBonus = emptyRes();

        for (const building of working) {
            const bonus = this.def(building).globalBonus;

            if (bonus) {
                globalBonus[bonus.resource] += bonus.percent;
            }
        }

        for (const building of working) {
            const def = this.def(building);
            const status = this.status.get(building.id)!;
            const centerScale = def.id === 'center' ? 1 + epoch : 1;
            let efficiency = def.workers ? employment : 1;

            if (def.powerUse) {
                efficiency *= powerRatio;
                status.noPower = powerRatio < 1;
            }

            const multiplier = levelOutput(building.level) * centerScale;

            for (const [resource, amount] of Object.entries(
                def.consumes ?? {},
            ) as [Resource, number][]) {
                const need = amount * multiplier * efficiency * dt;

                if (need > 0 && state.res[resource] < need) {
                    efficiency *= state.res[resource] / need;
                    status.starved = resource;
                }
            }

            status.efficiency = efficiency;

            for (const [resource, amount] of Object.entries(
                def.consumes ?? {},
            ) as [Resource, number][]) {
                const perSecond = amount * multiplier * efficiency;

                status.input[resource] = perSecond;
                rates[resource] -= perSecond;
                state.res[resource] = Math.max(
                    0,
                    state.res[resource] - perSecond * dt,
                );
            }

            for (const [resource, amount] of Object.entries(
                def.produces ?? {},
            ) as [Resource, number][]) {
                const nearby =
                    def.nearby && def.nearby.perTile
                        ? Math.min(
                              def.nearby.max,
                              status.nearbyTiles * def.nearby.perTile,
                          )
                        : 0;
                const bonus =
                    1 +
                    (this.techBonus(resource) + globalBonus[resource]) / 100;
                const era =
                    resource === 'food' ||
                    resource === 'wood' ||
                    resource === 'stone'
                        ? 1 + ERA_PRODUCTIVITY * epoch
                        : 1;
                const perSecond =
                    (amount + nearby) *
                    multiplier *
                    (1 + status.boost) *
                    bonus *
                    era *
                    efficiency;

                status.output[resource] = perSecond;
                rates[resource] += perSecond;
                state.res[resource] += perSecond * dt;
            }
        }

        // Taxes, and the food everyone eats.
        const tax =
            state.population *
            0.02 *
            (0.5 + this.happiness / 100) *
            (1 + (this.techBonus('gold') + globalBonus.gold) / 100);
        const eaten = state.population * FOOD_PER_PERSON;

        rates.gold += tax;
        rates.food -= eaten;
        state.res.gold += tax * dt;
        state.res.food -= eaten * dt;

        this.starving = state.res.food <= 0 && rates.food < 0;
        state.res.food = Math.max(0, state.res.food);

        this.caps = caps;
        this.rates = rates;
        this.housingCapacity = housing;
        this.jobs = jobs;
        this.workers = workers;
        this.employment = employment;
        this.powerSupply = powerSupply;
        this.powerDemand = powerDemand;
        this.defense = defense;
        this.clampToCaps();
        this.updateHappiness(powerRatio);
    }

    private updateHappiness(powerRatio: number): void {
        let weighted = 0;
        let weight = 0;
        const capacity = this.housingCapacity || 1;
        const fill = Math.min(1, this.state.population / capacity);

        for (const building of this.state.buildings) {
            const status = this.status.get(building.id);
            const def = this.def(building);

            if (
                !status ||
                status.happiness === null ||
                status.building ||
                !status.connected
            ) {
                continue;
            }

            const places = def.housing! * levelHousing(building.level);
            let happiness = status.happiness;

            if (def.powerUse) {
                happiness -= (1 - powerRatio) * 25;
            }

            status.residents = Math.floor(places * fill);
            weighted += happiness * places;
            weight += places;
        }

        let happiness = weight > 0 ? weighted / weight : 55;

        happiness += this.techBonus('happiness');
        happiness += this.state.moods.reduce(
            (sum, mood) => sum + mood.amount,
            0,
        );

        if (this.starving) {
            happiness -= 25;
        }

        this.happiness = Math.max(0, Math.min(100, happiness));
    }

    private updatePopulation(dt: number): void {
        const state = this.state;
        const capacity = this.housingCapacity;
        const happy = this.happiness;

        if (state.population > capacity) {
            state.population -=
                Math.max(0.2, (state.population - capacity) * 0.1) * dt;
            state.population = Math.max(capacity, state.population);
        } else if (this.starving) {
            state.population -= state.population * 0.01 * dt;
        } else if (happy < 25) {
            state.population -= state.population * 0.004 * dt;
        } else if (happy >= 40) {
            const growth =
                ((capacity - state.population) * 0.03 * (happy / 70) + 0.1) *
                dt;

            state.population = Math.min(capacity, state.population + growth);
        }

        state.population = Math.max(0, state.population);
    }

    private clampToCaps(): void {
        for (const resource of ['food', 'wood', 'stone'] as Resource[]) {
            if (this.caps[resource] > 0) {
                this.state.res[resource] = Math.min(
                    this.caps[resource],
                    this.state.res[resource],
                );
            }
        }
    }

    private randomEvent(): void {
        const state = this.state;
        const epoch = state.epoch;
        const roll = this.random();

        state.nextEventAt = state.time + 100 + this.random() * 80;

        if (epoch >= 1 && epoch <= 5 && roll < 0.3) {
            const strength = 12 + epoch * 22 + state.population * 0.04;

            if (this.defense >= strength) {
                const loot = 20 + epoch * 30;

                state.res.gold += loot;
                state.stats.raidsWon++;
                this.events.push({
                    type: 'toast',
                    text: `🛡️ Набег отбит! Трофеи: 💰 ${loot}`,
                    tone: 'good',
                });
            } else {
                state.res.food *= 0.8;
                state.res.gold *= 0.8;
                state.stats.raidsLost++;
                state.moods.push({
                    until: state.time + 120,
                    amount: -12,
                    reason: 'Набег',
                });
                this.events.push({
                    type: 'toast',
                    text: `⚔️ Набег! Разбойники унесли пятую часть еды и золота. Нужна защита: ${Math.ceil(strength)} (сейчас ${Math.floor(this.defense)})`,
                    tone: 'bad',
                });
            }

            return;
        }

        const pick = Math.floor(this.random() * 4);

        if (pick === 0) {
            const food = Math.floor(30 + this.caps.food * 0.15);

            this.gain({ food });
            this.events.push({
                type: 'toast',
                text: `🌾 Урожайный год: +${food} еды`,
                tone: 'good',
            });
        } else if (pick === 1) {
            const gold = 30 + epoch * 60;

            this.gain({ gold });
            this.events.push({
                type: 'toast',
                text: `🐪 Купеческий караван: +${gold} золота`,
                tone: 'good',
            });
        } else if (pick === 2) {
            const science = 10 + epoch * 50;

            this.gain({ science });
            this.events.push({
                type: 'toast',
                text: `🧙 Странствующий учёный: +${science} знаний`,
                tone: 'good',
            });
        } else {
            state.moods.push({
                until: state.time + 90,
                amount: 10,
                reason: 'Праздник',
            });
            this.events.push({
                type: 'toast',
                text: '🎉 Городской праздник: жители счастливее полторы минуты',
                tone: 'good',
            });
        }
    }

    private goalDone(id: string): boolean {
        const state = this.state;

        switch (id) {
            case 'roads':
                return this.count('road') >= 6;
            case 'houses':
                return this.count('house') >= 3;
            case 'farm':
                return this.count('farm') >= 1;
            case 'lumber':
                return this.count('lumber') >= 1;
            case 'quarry':
                return this.count('quarry') >= 1;
            case 'tech':
                return state.techs.length >= 1;
            case 'upgrade':
                return state.stats.upgraded >= 1;
            case 'well':
                return this.count('well') >= 1;
            case 'population':
                return state.population >= 25;
            case 'epoch':
                return state.epoch >= 1;
            default:
                return false;
        }
    }

    private checkGoals(quiet: boolean): void {
        while (
            this.state.goal < GOALS.length &&
            this.goalDone(GOALS[this.state.goal].id)
        ) {
            const goal = GOALS[this.state.goal];

            this.state.goal++;
            this.gain(goal.reward);

            if (!quiet) {
                this.events.push({
                    type: 'goal',
                    text: `✅ ${goal.text}  ·  награда ${formatCost(goal.reward)}`,
                });
            }
        }
    }

    /** The save as the server stores it. */
    serialize(): CityState {
        return { ...this.state, savedAt: Date.now() };
    }
}

export function techsOfEpoch(epoch: number) {
    return TECHS.filter((tech) => tech.epoch === epoch);
}
