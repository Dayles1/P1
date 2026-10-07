/**
 * The simulation facade. Owns the world state, the map and the buildings,
 * runs the systems once per game second (time & weather, construction,
 * economy, population, events, NPC decisions) and exposes the player's
 * actions. Every number it uses comes from the content files.
 */

import type { Content } from '../content/registry';
import type { Amounts, BuildingDef, Effects, LevelDef } from '../content/types';
import { Clock } from '../core/clock';
import { EventBus } from '../core/events';
import { between, mulberry32, pick, weighted } from '../core/random';
import type { Rng } from '../core/random';
import { generateMap } from '../world/generator';
import { featureCode } from '../world/world-map';
import type { WorldMap } from '../world/world-map';
import { NpcSystem } from './npcs';
import type {
    ActionResult,
    BuildingState,
    NpcState,
    WorldState,
} from './state';

/** What one building is doing right now. */
export interface BuildingStatus {
    complete: boolean;
    connected: boolean;
    efficiency: number;
    starved: string | null;
    noPower: boolean;
    nearbyFeatures: number;
    boost: number;
    fertility: number;
    happiness: number | null;
    pollution: number;
    residents: number;
    workers: number;
    output: Amounts;
    input: Amounts;
}

export interface Stats {
    rates: Amounts;
    caps: Amounts;
    housing: number;
    jobs: number;
    workers: number;
    employment: number;
    powerSupply: number;
    powerDemand: number;
    defense: number;
    happiness: number;
    starving: boolean;
}

export class Game {
    readonly content: Content;
    readonly events = new EventBus();
    readonly clock: Clock;
    state: WorldState;
    map: WorldMap;
    buildings = new Map<number, BuildingState>();
    status = new Map<number, BuildingStatus>();
    connectedRoads = new Set<number>();
    stats: Stats;
    npcs: NpcSystem;

    /** Bumped on every change the UI should notice. */
    revision = 0;

    readonly changedBuildings = new Set<number>();
    readonly deletedBuildings = new Set<number>();

    private structureDirty = true;
    private rng: Rng;

    constructor(
        content: Content,
        state: WorldState,
        map: WorldMap,
        buildings: BuildingState[],
        npcs: NpcState[],
    ) {
        this.content = content;
        this.state = state;
        this.map = map;
        this.clock = new Clock(content);
        this.rng = mulberry32(state.seed ^ Math.floor(state.time));

        for (const building of buildings) {
            if (content.hasBuilding(building.type)) {
                this.buildings.set(building.uid, building);
            }
        }

        this.stats = this.emptyStats();
        this.npcs = new NpcSystem(this, npcs);
        this.recalculate();
        this.updateEconomy(0);
    }

    static create(
        content: Content,
        seed = Math.floor(Math.random() * 2 ** 31),
    ): Game {
        const world = content.world;
        const map = generateMap(content, seed);
        const epoch = Math.max(
            0,
            content.epochs.findIndex((e) => e.id === world.start.epoch),
        );
        const state: WorldState = {
            seed,
            width: map.width,
            height: map.height,
            epoch,
            year: content.epoch(epoch).year,
            time: world.time.secondsPerDay * 0.3,
            resources: { ...content.emptyAmounts(), ...world.start.resources },
            population: world.start.population,
            weather: content.weather[0]?.id ?? 'clear',
            weatherUntil: 0,
            nextEventAt: world.events.firstAfter,
            moods: [],
            nextUid: 1,
            stats: { built: 0, upgraded: 0, demolished: 0, events: 0 },
        };
        const game = new Game(content, state, map, [], []);

        for (const start of world.start.buildings) {
            const def = content.building(start.type);
            const [x, y] =
                start.at === 'center'
                    ? [
                          Math.floor(map.width / 2 - def.size.w / 2),
                          Math.floor(map.height / 2 - def.size.h / 2),
                      ]
                    : start.at;

            game.addBuilding(
                start.type,
                x,
                y,
                def.autoLevelByEpoch ? epoch + 1 : 1,
                0,
            );
        }

        game.changedBuildings.clear();
        game.structureChanged();

        return game;
    }

    // ———————————————————————————————————————— Queries

    get epoch() {
        return this.content.epoch(this.state.epoch);
    }

    get palette() {
        return this.content.palette(this.state.epoch);
    }

    get season() {
        return this.clock.season(this.state.time);
    }

    get weather() {
        return (
            this.content.weather.find((w) => w.id === this.state.weather) ??
            this.content.weather[0]
        );
    }

    get center(): BuildingState | undefined {
        for (const building of this.buildings.values()) {
            if (building.type === 'town_center') {
                return building;
            }
        }

        return undefined;
    }

    def(building: BuildingState): BuildingDef {
        return this.content.building(building.type);
    }

    levelDef(building: BuildingState): LevelDef {
        return this.content.level(this.def(building), building.level);
    }

    effects(building: BuildingState): Effects {
        return this.levelDef(building).effects;
    }

    nameOf(building: BuildingState): string {
        return this.content.nameOf(this.def(building), this.state.epoch);
    }

    isComplete(building: BuildingState): boolean {
        return building.buildEnd <= this.state.time;
    }

    buildingAt(x: number, y: number): BuildingState | undefined {
        return this.buildings.get(this.map.occupantAt(x, y));
    }

    isRoad(index: number): boolean {
        return this.buildings.get(this.map.occupant[index])?.type === 'road';
    }

    count(type: string, minLevel = 1): number {
        let count = 0;

        for (const building of this.buildings.values()) {
            count +=
                building.type === type &&
                building.level >= minLevel &&
                this.isComplete(building)
                    ? 1
                    : 0;
        }

        return count;
    }

    territory(epoch = this.state.epoch): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        const radius = this.content.epoch(epoch).territory;
        const cx = Math.floor(this.map.width / 2);
        const cy = Math.floor(this.map.height / 2);

        return {
            minX: Math.max(0, cx - radius),
            minY: Math.max(0, cy - radius),
            maxX: Math.min(this.map.width - 1, cx + radius - 1),
            maxY: Math.min(this.map.height - 1, cy + radius - 1),
        };
    }

    inTerritory(x: number, y: number): boolean {
        const t = this.territory();

        return x >= t.minX && y >= t.minY && x <= t.maxX && y <= t.maxY;
    }

    lockReason(def: BuildingDef): string | null {
        if (def.hidden) {
            return 'Нельзя построить';
        }

        if (this.content.epochOrder(def.epoch) > this.state.epoch) {
            return `Эпоха «${this.content.epochs[this.content.epochOrder(def.epoch)]?.name ?? def.epoch}»`;
        }

        if (def.unique && this.count(def.id) > 0) {
            return 'Уже построено';
        }

        return null;
    }

    buildCost(def: BuildingDef): Amounts {
        let cost = def.levels[0].cost;

        for (const epoch of this.content.epochs.slice(
            0,
            this.state.epoch + 1,
        )) {
            cost = def.costByEpoch?.[epoch.id] ?? cost;
        }

        return cost;
    }

    upgradeBlock(building: BuildingState): string | null {
        const def = this.def(building);
        const next = def.levels[building.level];

        if (def.autoLevelByEpoch) {
            return 'Растёт вместе с эпохой';
        }

        if (!next) {
            return 'Максимальный уровень';
        }

        if (!this.isComplete(building)) {
            return 'Идёт стройка';
        }

        if (
            next.requiresEpoch &&
            this.content.epochOrder(next.requiresEpoch) > this.state.epoch
        ) {
            return `Уровень ${next.level} — в эпоху «${this.content.epochs[this.content.epochOrder(next.requiresEpoch)].name}»`;
        }

        return null;
    }

    upgradeCost(building: BuildingState): Amounts {
        return this.def(building).levels[building.level]?.cost ?? {};
    }

    moveCost(building: BuildingState, x: number, y: number): Amounts {
        const distance = Math.abs(building.x - x) + Math.abs(building.y - y);
        const def = this.def(building);

        return {
            gold: Math.ceil(
                this.content.world.economy.moveCostPerTile *
                    def.size.w *
                    def.size.h +
                    distance,
            ),
        };
    }

    canAfford(cost: Amounts): boolean {
        return Object.entries(cost).every(
            ([id, amount]) => (this.state.resources[id] ?? 0) >= amount - 1e-6,
        );
    }

    missing(cost: Amounts): string {
        const names = Object.entries(cost)
            .filter(([id, amount]) => (this.state.resources[id] ?? 0) < amount)
            .map(([id]) => this.content.resource(id)?.name.toLowerCase() ?? id);

        return names.length ? `Не хватает: ${names.join(', ')}` : '';
    }

    /** Tiles within `radius` of a footprint (Chebyshev), footprint excluded. */
    *around(
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number,
    ): Generator<[number, number]> {
        for (let ty = y - radius; ty < y + h + radius; ty++) {
            for (let tx = x - radius; tx < x + w + radius; tx++) {
                if (
                    this.map.inBounds(tx, ty) &&
                    !(tx >= x && tx < x + w && ty >= y && ty < y + h)
                ) {
                    yield [tx, ty];
                }
            }
        }
    }

    countFeatureNear(
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number,
        feature: string,
    ): number {
        const code = featureCode(feature as never);
        let count = 0;

        for (const [tx, ty] of this.around(x, y, w, h, radius)) {
            count += this.map.feature[this.map.index(tx, ty)] === code ? 1 : 0;
        }

        return count;
    }

    canPlace(type: string, x: number, y: number, ignoreUid = 0): ActionResult {
        const def = this.content.building(type);

        for (let ty = y; ty < y + def.size.h; ty++) {
            for (let tx = x; tx < x + def.size.w; tx++) {
                if (!this.map.inBounds(tx, ty) || !this.inTerritory(tx, ty)) {
                    return { ok: false, reason: 'За границей ваших земель' };
                }

                const biome = this.map.biomeAt(tx, ty);

                if (!biome.buildable) {
                    return {
                        ok: false,
                        reason: `Здесь нельзя строить: ${biome.name.toLowerCase()}`,
                    };
                }

                if (
                    def.placement.biomes &&
                    !def.placement.biomes.includes(biome.id)
                ) {
                    return {
                        ok: false,
                        reason: `Только на: ${def.placement.biomes.join(', ')}`,
                    };
                }

                if (this.map.featureAt(tx, ty)) {
                    return {
                        ok: false,
                        reason: 'Сначала расчистите клетку (лес, камни, камыш)',
                    };
                }

                const occupant = this.map.occupantAt(tx, ty);

                if (occupant && occupant !== ignoreUid) {
                    return { ok: false, reason: 'Место занято' };
                }
            }
        }

        return { ok: true };
    }

    // ———————————————————————————————————————— Actions

    place(type: string, x: number, y: number): ActionResult {
        const def = this.content.building(type);
        const locked = this.lockReason(def);

        if (locked) {
            return this.fail(locked);
        }

        const placement = this.canPlace(type, x, y);

        if (!placement.ok) {
            return this.fail(placement.reason!);
        }

        const cost = this.buildCost(def);

        if (!this.canAfford(cost)) {
            return this.fail(this.missing(cost));
        }

        this.pay(cost);

        const building = this.addBuilding(
            type,
            x,
            y,
            1,
            def.levels[0].buildTime,
        );

        this.state.stats.built += def.render === 'road' ? 0 : 1;
        this.structureChanged();
        this.events.emit({
            type: 'placed',
            uid: building.uid,
            x,
            y,
            w: def.size.w,
            h: def.size.h,
            sound: def.sounds.place,
        });

        return { ok: true };
    }

    upgrade(uid: number): ActionResult {
        const building = this.buildings.get(uid);

        if (!building) {
            return { ok: false };
        }

        const blocked = this.upgradeBlock(building);

        if (blocked) {
            return this.fail(blocked);
        }

        const cost = this.upgradeCost(building);

        if (!this.canAfford(cost)) {
            return this.fail(this.missing(cost));
        }

        const def = this.def(building);

        this.pay(cost);
        building.level++;
        building.buildStart = this.state.time;
        building.buildEnd = this.state.time + this.levelDef(building).buildTime;
        this.state.stats.upgraded++;
        this.changedBuildings.add(uid);
        this.structureChanged();
        this.events.emit({
            type: 'upgraded',
            uid,
            x: building.x,
            y: building.y,
            w: def.size.w,
            h: def.size.h,
            sound: def.sounds.upgrade,
        });

        return { ok: true };
    }

    demolish(uid: number): ActionResult {
        const building = this.buildings.get(uid);

        if (!building) {
            return { ok: false };
        }

        const def = this.def(building);

        if (def.unique && def.hidden) {
            return this.fail('Центр города снести нельзя');
        }

        for (const [id, amount] of Object.entries(this.buildCost(def))) {
            this.state.resources[id] =
                (this.state.resources[id] ?? 0) +
                Math.floor(amount * this.content.world.economy.refundShare);
        }

        this.removeBuilding(uid);
        this.state.stats.demolished++;
        this.structureChanged();
        this.npcs.onBuildingRemoved(uid);
        this.events.emit({
            type: 'removed',
            x: building.x,
            y: building.y,
            w: def.size.w,
            h: def.size.h,
            sound: def.sounds.demolish,
        });

        return { ok: true };
    }

    move(uid: number, x: number, y: number): ActionResult {
        const building = this.buildings.get(uid);

        if (!building || this.def(building).hidden) {
            return this.fail('Это здание нельзя перенести');
        }

        const placement = this.canPlace(building.type, x, y, uid);

        if (!placement.ok) {
            return this.fail(placement.reason!);
        }

        const cost = this.moveCost(building, x, y);

        if (!this.canAfford(cost)) {
            return this.fail(this.missing(cost));
        }

        this.pay(cost);
        this.occupy(building, 0);
        building.x = x;
        building.y = y;
        building.buildStart = this.state.time;
        building.buildEnd = this.state.time + 2;
        this.occupy(building, uid);
        this.changedBuildings.add(uid);
        this.structureChanged();

        const def = this.def(building);

        this.events.emit({
            type: 'placed',
            uid,
            x,
            y,
            w: def.size.w,
            h: def.size.h,
            sound: def.sounds.place,
        });

        return { ok: true };
    }

    /** Cuts a tree, breaks a rock or mows reeds. */
    clear(x: number, y: number): ActionResult {
        const feature = this.map.featureAt(x, y);

        if (!this.inTerritory(x, y)) {
            return this.fail('За границей ваших земель');
        }

        if (!feature) {
            return this.fail('Здесь нечего расчищать');
        }

        const rule = this.content.world.economy.clearFeature[feature] ?? {
            cost: {},
            gain: {},
        };

        if (!this.canAfford(rule.cost)) {
            return this.fail(this.missing(rule.cost));
        }

        this.pay(rule.cost);
        this.gain(rule.gain);
        this.map.setFeature(x, y, null);
        this.structureChanged();

        const text = Object.entries(rule.gain)
            .map(
                ([id, amount]) =>
                    `+${amount} ${this.content.resource(id)?.icon ?? id}`,
            )
            .join(' ');

        this.events.emit({ type: 'cleared', x, y, text });

        return { ok: true };
    }

    epochChecklist(): { label: string; done: boolean }[] {
        const next = this.epoch.next;

        if (!next) {
            return [];
        }

        const items = [
            {
                label: `Жителей: ${Math.floor(this.state.population)} / ${next.population}`,
                done: this.state.population >= next.population,
            },
        ];

        for (const need of next.buildings) {
            const def = this.content.building(need.type);
            const have = this.count(need.type, need.level ?? 1);

            items.push({
                label: `${def.icon} ${this.content.nameOf(def, this.state.epoch)}${need.level ? ` (ур. ${need.level}+)` : ''}: ${have} / ${need.count}`,
                done: have >= need.count,
            });
        }

        const cost = Object.entries(next.cost)
            .map(
                ([id, amount]) =>
                    `${this.content.resource(id)?.icon ?? id} ${amount}`,
            )
            .join('  ');

        items.push({
            label: `Казна: ${cost}`,
            done: this.canAfford(next.cost),
        });

        return items;
    }

    canAdvance(): boolean {
        const list = this.epochChecklist();

        return list.length > 0 && list.every((item) => item.done);
    }

    advanceEpoch(): ActionResult {
        const next = this.epoch.next;

        if (!next || !this.canAdvance()) {
            return this.fail('Условия ещё не выполнены');
        }

        this.pay(next.cost);
        this.state.epoch++;
        this.state.year = this.epoch.year;

        for (const building of this.buildings.values()) {
            if (this.def(building).autoLevelByEpoch) {
                building.level = Math.min(
                    this.def(building).levels.length,
                    this.state.epoch + 1,
                );
                this.changedBuildings.add(building.uid);
            }
        }

        this.npcs.onEpochChanged();
        this.structureChanged();
        this.events.emit({ type: 'epoch', epoch: this.state.epoch });

        return { ok: true };
    }

    score(): number {
        let levels = 0;

        for (const building of this.buildings.values()) {
            levels += this.def(building).render === 'road' ? 0 : building.level;
        }

        return Math.floor(
            this.state.population + levels * 10 + this.state.epoch * 1000,
        );
    }

    // ———————————————————————————————————————— Simulation

    tick(dt: number, quiet = false): void {
        const state = this.state;
        const before = this.season.id;

        state.time += dt;
        state.year = Math.min(
            (this.content.epochs[state.epoch + 1]?.year ?? 2999) - 1,
            state.year +
                (this.epoch.yearsPerDay * dt) / this.clock.secondsPerDay,
        );
        state.moods = state.moods.filter((mood) => mood.until > state.time);

        if (!quiet && this.season.id !== before) {
            this.events.emit({ type: 'season', season: this.season.id });
            this.events.emit({
                type: 'toast',
                text: `${this.season.icon} Наступает ${this.season.name.toLowerCase()}`,
                tone: 'info',
            });
        }

        this.updateWeather(quiet);

        for (const building of this.buildings.values()) {
            if (
                building.buildEnd > state.time - dt &&
                building.buildEnd <= state.time
            ) {
                this.structureDirty = true;

                if (!quiet && this.def(building).render !== 'road') {
                    this.events.emit({ type: 'built', uid: building.uid });
                }
            }
        }

        if (this.structureDirty) {
            this.recalculate();
        }

        this.updateEconomy(dt);
        this.updatePopulation(dt);

        if (state.time >= state.nextEventAt) {
            this.randomEvent(quiet);
        }

        this.npcs.think(quiet);
        this.revision++;
    }

    // ———————————————————————————————————————— Internals

    private emptyStats(): Stats {
        return {
            rates: this.content.emptyAmounts(),
            caps: this.content.emptyAmounts(),
            housing: 0,
            jobs: 0,
            workers: 0,
            employment: 1,
            powerSupply: 0,
            powerDemand: 0,
            defense: 0,
            happiness: 50,
            starving: false,
        };
    }

    private fail(reason: string): ActionResult {
        this.events.emit({ type: 'error', text: reason });

        return { ok: false, reason };
    }

    private pay(cost: Amounts): void {
        for (const [id, amount] of Object.entries(cost)) {
            this.state.resources[id] = Math.max(
                0,
                (this.state.resources[id] ?? 0) - amount,
            );
        }
    }

    private gain(amounts: Amounts): void {
        for (const [id, amount] of Object.entries(amounts)) {
            this.state.resources[id] = (this.state.resources[id] ?? 0) + amount;
        }

        this.clampToCaps();
    }

    private addBuilding(
        type: string,
        x: number,
        y: number,
        level: number,
        buildTime: number,
    ): BuildingState {
        const building: BuildingState = {
            uid: this.state.nextUid++,
            type,
            x,
            y,
            level,
            buildStart: this.state.time,
            buildEnd: this.state.time + buildTime,
        };

        this.buildings.set(building.uid, building);
        this.occupy(building, building.uid);
        this.changedBuildings.add(building.uid);

        return building;
    }

    private removeBuilding(uid: number): void {
        const building = this.buildings.get(uid);

        if (!building) {
            return;
        }

        this.occupy(building, 0);
        this.buildings.delete(uid);
        this.changedBuildings.delete(uid);
        this.deletedBuildings.add(uid);
    }

    private occupy(building: BuildingState, uid: number): void {
        const { w, h } = this.def(building).size;

        for (let y = building.y; y < building.y + h; y++) {
            for (let x = building.x; x < building.x + w; x++) {
                if (this.map.inBounds(x, y)) {
                    this.map.occupant[this.map.index(x, y)] = uid;
                }
            }
        }
    }

    structureChanged(): void {
        this.structureDirty = true;
        this.recalculate();
        this.updateEconomy(0);
        this.revision++;
    }

    /** Gap in tiles between two footprints (0 when touching). */
    distance(a: BuildingState, b: BuildingState): number {
        const sa = this.def(a).size;
        const sb = this.def(b).size;
        const dx = Math.max(0, a.x - (b.x + sb.w - 1), b.x - (a.x + sa.w - 1));
        const dy = Math.max(0, a.y - (b.y + sb.h - 1), b.y - (a.y + sa.h - 1));

        return Math.max(dx, dy);
    }

    isConnected(building: BuildingState): boolean {
        const def = this.def(building);

        if (def.render === 'road') {
            return this.connectedRoads.has(
                this.map.index(building.x, building.y),
            );
        }

        if (!def.placement.requiresRoad) {
            return true;
        }

        for (const [x, y] of this.around(
            building.x,
            building.y,
            def.size.w,
            def.size.h,
            1,
        )) {
            const diagonal =
                (x < building.x || x >= building.x + def.size.w) &&
                (y < building.y || y >= building.y + def.size.h);

            if (diagonal) {
                continue;
            }

            const index = this.map.index(x, y);
            const neighbour = this.buildings.get(this.map.occupant[index]);

            if (
                this.connectedRoads.has(index) ||
                (neighbour &&
                    this.def(neighbour).hidden &&
                    this.def(neighbour).unique)
            ) {
                return true;
            }
        }

        return false;
    }

    private findConnectedRoads(): void {
        const connected = new Set<number>();
        const queue: number[] = [];
        const center = this.center;

        if (center) {
            const { w, h } = this.def(center).size;

            for (const [x, y] of this.around(center.x, center.y, w, h, 1)) {
                const index = this.map.index(x, y);

                if (this.isRoad(index)) {
                    connected.add(index);
                    queue.push(index);
                }
            }
        }

        while (queue.length) {
            const index = queue.pop()!;
            const x = index % this.map.width;
            const y = Math.floor(index / this.map.width);

            for (const [nx, ny] of [
                [x + 1, y],
                [x - 1, y],
                [x, y + 1],
                [x, y - 1],
            ]) {
                if (!this.map.inBounds(nx, ny)) {
                    continue;
                }

                const next = this.map.index(nx, ny);

                if (!connected.has(next) && this.isRoad(next)) {
                    connected.add(next);
                    queue.push(next);
                }
            }
        }

        this.connectedRoads = connected;
    }

    /**
     * Everything that only changes when something is built, moved,
     * upgraded or cleared: road connections, terrain and boost bonuses,
     * and how pleasant each home's surroundings are.
     */
    private recalculate(): void {
        this.structureDirty = false;
        this.findConnectedRoads();

        const all = [...this.buildings.values()];
        const working = all.filter(
            (b) => this.isComplete(b) && this.isConnected(b),
        );
        const status = new Map<number, BuildingStatus>();

        for (const building of all) {
            const def = this.def(building);
            const effects = this.effects(building);
            let boost = 0;
            let happiness: number | null = null;
            let pollution = 0;
            let fertility = 0;

            for (let y = building.y; y < building.y + def.size.h; y++) {
                for (let x = building.x; x < building.x + def.size.w; x++) {
                    fertility += this.map.inBounds(x, y)
                        ? this.map.biomeAt(x, y).fertility
                        : 0;
                }
            }

            fertility /= def.size.w * def.size.h;

            for (const other of working) {
                const otherEffects = this.effects(other);
                const distance = this.distance(building, other);

                if (
                    otherEffects.boost?.targets.includes(def.id) &&
                    distance <= otherEffects.boost.radius
                ) {
                    boost += otherEffects.boost.percent / 100;
                }

                if (
                    otherEffects.pollution &&
                    distance <= otherEffects.pollution.radius
                ) {
                    pollution += otherEffects.pollution.amount;
                }
            }

            if (effects.housing && !def.hidden) {
                let services = 0;

                for (const other of working) {
                    const aura = this.effects(other).aura;

                    if (
                        other.uid !== building.uid &&
                        aura &&
                        this.distance(building, other) <= aura.radius
                    ) {
                        services += aura.happiness;
                    }
                }

                happiness =
                    this.content.world.population.baseHappiness +
                    Math.min(services, 55) -
                    pollution;
            }

            status.set(building.uid, {
                complete: this.isComplete(building),
                connected: this.isConnected(building),
                efficiency: 0,
                starved: null,
                noPower: false,
                nearbyFeatures: effects.near
                    ? this.countFeatureNear(
                          building.x,
                          building.y,
                          def.size.w,
                          def.size.h,
                          effects.near.radius,
                          effects.near.feature,
                      )
                    : 0,
                boost,
                fertility,
                happiness,
                pollution,
                residents: 0,
                workers: 0,
                output: {},
                input: {},
            });
        }

        this.status = status;
    }

    private updateEconomy(dt: number): void {
        const content = this.content;
        const rules = content.world;
        const state = this.state;
        const stats = this.emptyStats();
        const season = this.season;
        const weatherFertility = this.weather?.fertility ?? 1;
        const active: BuildingState[] = [];

        for (const resource of content.resources) {
            stats.caps[resource.id] = resource.capped
                ? rules.economy.storageBase
                : Infinity;
        }

        for (const building of this.buildings.values()) {
            const status = this.status.get(building.uid);
            const effects = this.effects(building);

            if (!status) {
                continue;
            }

            status.complete = this.isComplete(building);
            status.efficiency = 0;
            status.output = {};
            status.input = {};
            status.starved = null;
            status.noPower = false;

            if (!status.complete || !status.connected) {
                continue;
            }

            active.push(building);
            stats.housing += effects.housing;
            stats.jobs += effects.jobs;
            stats.powerSupply += effects.power;
            stats.powerDemand += effects.powerUse;
            stats.defense += effects.defense;

            for (const resource of content.resources) {
                if (resource.capped) {
                    stats.caps[resource.id] += effects.storage;
                }
            }
        }

        stats.workers = state.population * rules.population.workforceShare;
        stats.employment =
            stats.jobs > 0 ? Math.min(1, stats.workers / stats.jobs) : 1;

        const powerRatio =
            stats.powerDemand > 0
                ? Math.min(1, stats.powerSupply / stats.powerDemand)
                : 1;

        for (const building of active) {
            const effects = this.effects(building);
            const status = this.status.get(building.uid)!;
            let efficiency = effects.jobs ? stats.employment : 1;

            if (effects.powerUse) {
                efficiency *= powerRatio;
                status.noPower = powerRatio < 1;
            }

            status.workers = Math.floor(effects.jobs * stats.employment);

            for (const [id, amount] of Object.entries(effects.consumes)) {
                const need = amount * efficiency * dt;

                if (need > 0 && (state.resources[id] ?? 0) < need) {
                    efficiency *= (state.resources[id] ?? 0) / need;
                    status.starved = id;
                }
            }

            status.efficiency = efficiency;

            for (const [id, amount] of Object.entries(effects.consumes)) {
                const perSecond = amount * efficiency;

                status.input[id] = perSecond;
                stats.rates[id] = (stats.rates[id] ?? 0) - perSecond;
                state.resources[id] = Math.max(
                    0,
                    (state.resources[id] ?? 0) - perSecond * dt,
                );
            }

            const nearby = effects.near
                ? Math.min(
                      effects.near.max,
                      status.nearbyFeatures * effects.near.perTile,
                  )
                : 0;
            const seasonal = effects.seasonal
                ? season.fertility * weatherFertility * status.fertility
                : 1;

            for (const [id, amount] of Object.entries(effects.produces)) {
                const perSecond =
                    (amount + nearby) *
                    (1 + status.boost) *
                    seasonal *
                    efficiency;

                status.output[id] = perSecond;
                stats.rates[id] = (stats.rates[id] ?? 0) + perSecond;
                state.resources[id] =
                    (state.resources[id] ?? 0) + perSecond * dt;
            }
        }

        // Happiness of every home.
        let weighted = 0;
        let weight = 0;
        const cold = season.temperature < 0 ? rules.population.coldPenalty : 0;
        const fill = Math.min(1, state.population / Math.max(1, stats.housing));

        for (const building of active) {
            const status = this.status.get(building.uid)!;
            const effects = this.effects(building);

            if (status.happiness === null) {
                continue;
            }

            let happiness = status.happiness - cold;

            if (effects.powerUse) {
                happiness -= (1 - powerRatio) * rules.population.noPowerPenalty;
            }

            status.residents = Math.floor(effects.housing * fill);
            weighted += happiness * effects.housing;
            weight += effects.housing;
        }

        let happiness =
            weight > 0
                ? weighted / weight
                : rules.population.baseHappiness + 10;

        happiness += state.moods.reduce((sum, mood) => sum + mood.amount, 0);

        // Taxes and food.
        const tax =
            state.population *
            rules.population.taxPerPerson *
            (0.5 + this.stats.happiness / 100);
        const eaten = state.population * rules.population.foodPerPerson;

        stats.rates.gold = (stats.rates.gold ?? 0) + tax;
        stats.rates.food = (stats.rates.food ?? 0) - eaten;
        state.resources.gold = (state.resources.gold ?? 0) + tax * dt;
        state.resources.food = (state.resources.food ?? 0) - eaten * dt;
        stats.starving = state.resources.food <= 0 && stats.rates.food < 0;
        state.resources.food = Math.max(0, state.resources.food);

        if (stats.starving) {
            happiness -= rules.population.starvingPenalty;
        }

        stats.happiness = Math.max(0, Math.min(100, happiness));
        this.stats = stats;
        this.clampToCaps();
    }

    private updatePopulation(dt: number): void {
        const state = this.state;
        const capacity = this.stats.housing;
        const happy = this.stats.happiness;
        const rules = this.content.world.population;
        const rate = rules.growthRate;

        if (state.population > capacity) {
            state.population = Math.max(
                capacity,
                state.population -
                    Math.max(
                        0.2,
                        (state.population - capacity) *
                            rules.overcrowdingDecline,
                    ) *
                        dt,
            );
        } else if (this.stats.starving) {
            state.population -= state.population * rules.starvingDecline * dt;
        } else if (happy < 25) {
            state.population -= state.population * rules.unhappyDecline * dt;
        } else if (happy >= 40) {
            state.population = Math.min(
                capacity,
                state.population +
                    ((capacity - state.population) * rate * (happy / 70) +
                        0.1) *
                        dt,
            );
        }

        state.population = Math.max(0, state.population);
    }

    private clampToCaps(): void {
        for (const resource of this.content.resources) {
            if (resource.capped) {
                this.state.resources[resource.id] = Math.min(
                    this.stats.caps[resource.id],
                    this.state.resources[resource.id] ?? 0,
                );
            }
        }
    }

    private updateWeather(quiet: boolean): void {
        const state = this.state;

        if (state.time < state.weatherUntil) {
            return;
        }

        const next =
            weighted(this.rng, this.season.weather) ||
            this.content.weather[0].id;
        const minutes = between(
            this.rng,
            this.content.bundle.climate.weatherMinutes,
        );

        state.weatherUntil = state.time + minutes * this.clock.secondsPerDay;

        if (next !== state.weather) {
            state.weather = next;

            if (!quiet) {
                this.events.emit({ type: 'weather', weather: next });
            }
        }
    }

    private randomEvent(quiet: boolean): void {
        const state = this.state;
        const rules = this.content.world.events;
        const candidates = rules.list.filter(
            (event) =>
                (!event.seasons || event.seasons.includes(this.season.id)) &&
                (!event.epochs || event.epochs.includes(this.epoch.id)),
        );

        state.nextEventAt = state.time + between(this.rng, rules.every);

        if (!candidates.length || quiet) {
            return;
        }

        const chosen = weighted(
            this.rng,
            Object.fromEntries(candidates.map((c) => [c.id, c.weight])),
        );
        const event = candidates.find((e) => e.id === chosen) ?? candidates[0];
        let amount = 0;

        for (const [id, value] of Object.entries(event.gain ?? {})) {
            const delta =
                value < 1
                    ? Math.floor(
                          (this.stats.caps[id] === Infinity
                              ? 1000
                              : this.stats.caps[id]) * value,
                      )
                    : value * (1 + state.epoch);

            amount += delta;
            this.gain({ [id]: delta });
        }

        for (const [id, value] of Object.entries(event.lose ?? {})) {
            const delta =
                value < 1
                    ? Math.floor((state.resources[id] ?? 0) * value)
                    : value;

            amount += delta;
            state.resources[id] = Math.max(
                0,
                (state.resources[id] ?? 0) - delta,
            );
        }

        if (event.mood) {
            state.moods.push({
                until: state.time + event.mood.seconds,
                amount: event.mood.amount,
                reason: event.id,
            });
        }

        state.stats.events++;
        this.events.emit({
            type: 'toast',
            text: event.text.replace(':amount', String(Math.floor(amount))),
            tone:
                event.lose || (event.mood && event.mood.amount < 0)
                    ? 'bad'
                    : 'good',
        });
    }

    randomName(): string {
        const names = this.content.bundle.npcs.names;

        return `${pick(this.rng, names.first)} ${pick(this.rng, names.last)}`;
    }

    random(): number {
        return this.rng();
    }
}
