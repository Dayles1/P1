/**
 * The simulation facade. Owns the world state, the map and the buildings,
 * runs the systems once per game second (time & weather, construction,
 * research, economy, population, goals, events, NPC decisions) and exposes
 * the player's actions. Every number it uses comes from the content files.
 *
 * Nothing changes by itself when an era begins: a building keeps the level
 * (and so the look) the player gave it. Eras only open new levels,
 * technologies, resources and land.
 */

import type { Content } from '../content/registry';
import type {
    Amounts,
    BlueprintDef,
    BuildingDef,
    DistrictPolicyDef,
    Effects,
    GoalDef,
    LevelDef,
    Palette,
    RoofShape,
    TechBonus,
    TechDef,
} from '../content/types';
import { Clock } from '../core/clock';
import { EventBus } from '../core/events';
import { between, hash2, mulberry32, pick, weighted } from '../core/random';
import type { Rng } from '../core/random';
import { generateMap } from '../world/generator';
import { featureCode } from '../world/world-map';
import type { WorldMap } from '../world/world-map';
import { NpcSystem } from './npcs';
import type {
    ActionResult,
    BuildingState,
    BuildingStyle,
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
    /** The district hall whose district it stands in. */
    district: number | null;
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
    tourism: number;
}

/** Every researched technology's bonus added up. */
export interface Bonuses {
    produces: Record<string, number>;
    happiness: number;
    housing: number;
    storage: number;
    buildSpeed: number;
    tax: number;
    research: number;
}

export interface GoalProgress {
    current: number;
    target: number;
    done: boolean;
}

const NO_POLICY: DistrictPolicyDef['effects'] = {};

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
    bonuses: Bonuses;
    npcs: NpcSystem;

    /** Bumped on every change the UI should notice. */
    revision = 0;

    /** Tester: nothing costs anything and the stores stay full (not saved). */
    infinite = false;

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
        this.bonuses = this.collectBonuses();
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
            techs: [],
            research: null,
            blueprints: [],
            achievements: [],
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

            game.addBuilding(start.type, x, y, start.level ?? 1, 0);
        }

        game.changedBuildings.clear();
        game.structureChanged();

        return game;
    }

    // ———————————————————————————————————————— Queries

    get epoch() {
        return this.content.epoch(this.state.epoch);
    }

    /** The current era's palette (sky, interface); buildings use their own. */
    get palette() {
        return this.content.epoch(this.state.epoch).palette;
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
            if (this.def(building).role === 'center') {
                return building;
            }
        }

        return undefined;
    }

    /** The Architects' Bureau, once it stands. */
    get bureau(): BuildingState | undefined {
        for (const building of this.buildings.values()) {
            if (
                this.def(building).role === 'bureau' &&
                this.isComplete(building)
            ) {
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

    /** The era (index) a building's current level belongs to. */
    levelEpoch(building: BuildingState): number {
        return this.content.epochOrder(this.levelDef(building).epoch);
    }

    nameOf(building: BuildingState): string {
        return building.district?.name || this.levelDef(building).name;
    }

    isComplete(building: BuildingState): boolean {
        return building.buildEnd <= this.state.time;
    }

    buildingAt(x: number, y: number): BuildingState | undefined {
        return this.buildings.get(this.map.occupantAt(x, y));
    }

    isRoad(index: number): boolean {
        const building = this.buildings.get(this.map.occupant[index]);

        return building !== undefined && this.def(building).role === 'road';
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

    hasTech(id: string): boolean {
        return this.state.techs.includes(id);
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

    /** Resources the player knows about by now (or happens to hold). */
    visibleResources() {
        return this.content.resources.filter(
            (resource) =>
                this.content.epochOrder(resource.epoch) <= this.state.epoch ||
                (this.state.resources[resource.id] ?? 0) > 0,
        );
    }

    // ———————————————————————————————————————— Levels & prices

    /** Why a level cannot be built or reached yet; null when it can. */
    levelLock(def: BuildingDef, level: number): string | null {
        const levelDef = def.levels[level - 1];

        if (!levelDef) {
            return 'Нет такого уровня';
        }

        const epoch = this.content.epochOrder(levelDef.epoch);

        if (epoch > this.state.epoch) {
            return `Откроется в эпоху «${this.content.epoch(epoch).name}»`;
        }

        if (levelDef.tech && !this.hasTech(levelDef.tech)) {
            return `Нужна технология «${this.content.tech(levelDef.tech)?.name ?? levelDef.tech}»`;
        }

        return null;
    }

    /** Levels that can be built straight away right now. */
    availableLevels(def: BuildingDef): number[] {
        return def.levels
            .filter((level) => !this.levelLock(def, level.level))
            .map((level) => level.level);
    }

    lockReason(def: BuildingDef): string | null {
        if (def.hidden) {
            return 'Нельзя построить';
        }

        if (!this.availableLevels(def).length) {
            return this.levelLock(def, 1);
        }

        if (def.unique && this.count(def.id) + this.underConstruction(def.id)) {
            return 'Уже построено';
        }

        return null;
    }

    buildCost(def: BuildingDef, level = 1): Amounts {
        return this.content.level(def, level).cost;
    }

    upgradeBlock(building: BuildingState): string | null {
        const def = this.def(building);

        if (!def.levels[building.level]) {
            return 'Максимальный уровень';
        }

        if (!this.isComplete(building)) {
            return 'Идёт стройка';
        }

        return this.levelLock(def, building.level + 1);
    }

    upgradeCost(building: BuildingState): Amounts {
        const next = this.def(building).levels[building.level];

        if (!next) {
            return {};
        }

        if (next.upgrade) {
            return next.upgrade;
        }

        const share = this.content.world.economy.upgradeShare ?? 0.7;

        return Object.fromEntries(
            Object.entries(next.cost).map(([id, amount]) => [
                id,
                Math.ceil(amount * share),
            ]),
        );
    }

    buildTime(level: LevelDef): number {
        return (
            level.buildTime * Math.max(0.2, 1 - this.bonuses.buildSpeed / 100)
        );
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
        if (this.infinite) {
            return true;
        }

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

    // ———————————————————————————————————————— Looks

    /**
     * The palette a building is drawn with: its level's era, then its
     * blueprint, then the player's own colours.
     */
    paletteOf(building: BuildingState): Palette {
        const base = this.content.levelPalette(this.levelDef(building));
        const style = building.style;

        if (!style) {
            return base;
        }

        const blueprint = this.blueprintOf(building);

        return {
            ...base,
            ...(blueprint?.colors ?? {}),
            ...style.colors,
            ...(style.colors.wall ? { walls: [style.colors.wall] } : {}),
            ...(blueprint?.colors.wall && !style.colors.wall
                ? { walls: [blueprint.colors.wall] }
                : {}),
        } as Palette;
    }

    blueprintOf(building: BuildingState): BlueprintDef | undefined {
        const id = building.style?.blueprint;

        return id ? this.content.blueprint(id) : undefined;
    }

    /** A roof shape the building's blueprint swaps in, if any. */
    roofOf(building: BuildingState): RoofShape | null {
        return this.blueprintOf(building)?.roof ?? null;
    }

    /** Changes whenever anything about a building's look changes. */
    lookKey(building: BuildingState): string {
        const style = building.style;

        return `${building.type}:${building.level}:${style?.blueprint ?? ''}:${style ? Object.values(style.colors).join(',') : ''}`;
    }

    blueprintFits(blueprint: BlueprintDef, def: BuildingDef): boolean {
        return blueprint.buildings.length
            ? blueprint.buildings.includes(def.id)
            : !def.hidden && !def.role;
    }

    blueprintLock(blueprint: BlueprintDef): string | null {
        if (this.content.epochOrder(blueprint.epoch) > this.state.epoch) {
            return `Эпоха «${this.content.epochById(blueprint.epoch).name}»`;
        }

        const bureau = this.bureau;

        if (!bureau) {
            return 'Нужно бюро архитекторов';
        }

        if (bureau.level < blueprint.tier) {
            return `Нужно бюро уровня ${blueprint.tier}`;
        }

        return null;
    }

    // ———————————————————————————————————————— Districts

    districtHalls(): BuildingState[] {
        return [...this.buildings.values()].filter(
            (b) => this.def(b).role === 'district',
        );
    }

    policyOf(hall: BuildingState | undefined): DistrictPolicyDef | undefined {
        const id = hall?.district?.policy;

        return id
            ? this.content.world.districts.policies.find((p) => p.id === id)
            : undefined;
    }

    /** The district hall a tile belongs to (the nearest one in reach). */
    districtAt(x: number, y: number): BuildingState | undefined {
        const radius = this.content.world.districts.radius;
        let best: BuildingState | undefined;
        let bestDistance = Infinity;

        for (const hall of this.districtHalls()) {
            if (!this.isComplete(hall)) {
                continue;
            }

            const { w, h } = this.def(hall).size;
            const dx = Math.max(0, hall.x - x, x - (hall.x + w - 1));
            const dy = Math.max(0, hall.y - y, y - (hall.y + h - 1));
            const distance = Math.max(dx, dy);

            if (distance <= radius && distance < bestDistance) {
                best = hall;
                bestDistance = distance;
            }
        }

        return best;
    }

    // ———————————————————————————————————————— Technologies

    techLock(tech: TechDef): string | null {
        if (this.hasTech(tech.id)) {
            return 'Изучено';
        }

        if (this.content.epochOrder(tech.epoch) > this.state.epoch) {
            return `Эпоха «${this.content.epochById(tech.epoch).name}»`;
        }

        const missing = tech.requires.filter((id) => !this.hasTech(id));

        if (missing.length) {
            return `Сначала: ${missing.map((id) => this.content.tech(id)?.name ?? id).join(', ')}`;
        }

        if (this.state.research) {
            return 'Идёт другое исследование';
        }

        return null;
    }

    researchTime(tech: TechDef): number {
        return tech.time * Math.max(0.2, 1 - this.bonuses.research / 100);
    }

    /** What a technology opens: building levels that need it. */
    techUnlocks(tech: TechDef): { def: BuildingDef; level: LevelDef }[] {
        const result: { def: BuildingDef; level: LevelDef }[] = [];

        for (const def of this.content.buildings) {
            for (const level of def.levels) {
                if (level.tech === tech.id) {
                    result.push({ def, level });
                }
            }
        }

        return result;
    }

    // ———————————————————————————————————————— Goals

    goalProgress(goal: GoalDef): GoalProgress {
        const condition = goal.condition;
        const state = this.state;
        let current = 0;
        let target = 1;

        switch (condition.type) {
            case 'population':
                current = Math.floor(state.population);
                target = condition.value;
                break;
            case 'building':
                current = this.count(condition.building, condition.level ?? 1);
                target = condition.count;
                break;
            case 'epoch':
                current =
                    state.epoch >= this.content.epochOrder(condition.epoch)
                        ? 1
                        : 0;
                break;
            case 'tech':
                current = this.hasTech(condition.tech) ? 1 : 0;
                break;
            case 'techs':
                current = state.techs.length;
                target = condition.count;
                break;
            case 'resource':
                current = Math.floor(state.resources[condition.resource] ?? 0);
                target = condition.value;
                break;
            case 'happiness':
                current =
                    state.population >= 10
                        ? Math.round(this.stats.happiness)
                        : 0;
                target = condition.value;
                break;
            case 'districts':
                current = this.districtHalls().filter((h) =>
                    this.isComplete(h),
                ).length;
                target = condition.count;
                break;
            case 'blueprints':
                current = state.blueprints.length;
                target = condition.count;
                break;
            case 'heritage':
                current = [...this.buildings.values()].filter(
                    (b) =>
                        this.def(b).role !== 'road' &&
                        this.isComplete(b) &&
                        state.epoch - this.levelEpoch(b) >= condition.age,
                ).length;
                target = condition.count;
                break;
        }

        return {
            current: Math.min(current, target),
            target,
            done: current >= target,
        };
    }

    /** Open goals of the eras reached so far, nearest to done first. */
    openGoals(): GoalDef[] {
        return this.content.goals
            .filter(
                (goal) =>
                    !this.state.achievements.includes(goal.id) &&
                    this.content.epochOrder(goal.epoch) <= this.state.epoch,
            )
            .sort((a, b) => {
                const pa = this.goalProgress(a);
                const pb = this.goalProgress(b);

                return pb.current / pb.target - pa.current / pa.target;
            });
    }

    // ———————————————————————————————————————— Era

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
            const name = need.level
                ? this.content.level(def, need.level).name
                : def.name;

            items.push({
                label: `${def.icon} ${name}${need.level ? ` (ур. ${need.level}+)` : ''}: ${have} / ${need.count}`,
                done: have >= need.count,
            });
        }

        for (const id of next.techs ?? []) {
            const tech = this.content.tech(id);

            items.push({
                label: `${tech?.icon ?? '🔬'} Технология «${tech?.name ?? id}»`,
                done: this.hasTech(id),
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

    score(): number {
        let levels = 0;

        for (const building of this.buildings.values()) {
            levels += this.def(building).role === 'road' ? 0 : building.level;
        }

        return Math.floor(
            this.state.population +
                levels * 10 +
                this.state.epoch * 1000 +
                this.state.techs.length * 50 +
                this.state.achievements.length * 100,
        );
    }

    // ———————————————————————————————————————— Placement

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
                const bridge =
                    def.placement.overWater && this.map.isOpenWater(tx, ty);

                if (!biome.buildable && !bridge) {
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

        const nearWater = def.placement.nearWater;

        if (nearWater) {
            let water = false;

            for (const [tx, ty] of this.around(
                x,
                y,
                def.size.w,
                def.size.h,
                nearWater,
            )) {
                if (this.map.biomeAt(tx, ty).water) {
                    water = true;
                    break;
                }
            }

            if (!water) {
                return { ok: false, reason: 'Нужна вода рядом' };
            }
        }

        return { ok: true };
    }

    // ———————————————————————————————————————— Actions

    place(type: string, x: number, y: number, level = 1): ActionResult {
        const def = this.content.building(type);
        const locked = this.lockReason(def) ?? this.levelLock(def, level);

        if (locked) {
            return this.fail(locked);
        }

        const placement = this.canPlace(type, x, y);

        if (!placement.ok) {
            return this.fail(placement.reason!);
        }

        const cost = this.buildCost(def, level);

        if (!this.canAfford(cost)) {
            return this.fail(this.missing(cost));
        }

        this.pay(cost);

        const building = this.addBuilding(
            type,
            x,
            y,
            level,
            this.buildTime(this.content.level(def, level)),
        );

        if (def.role === 'district') {
            building.district = {
                name: this.districtName(),
                policy: null,
            };
        }

        this.state.stats.built += def.role === 'road' ? 0 : 1;
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

    upgrade(uid: number, quiet = false): ActionResult {
        const building = this.buildings.get(uid);

        if (!building) {
            return { ok: false };
        }

        const blocked = this.upgradeBlock(building);

        if (blocked) {
            return quiet ? { ok: false, reason: blocked } : this.fail(blocked);
        }

        const cost = this.upgradeCost(building);

        if (!this.canAfford(cost)) {
            return quiet
                ? { ok: false, reason: this.missing(cost) }
                : this.fail(this.missing(cost));
        }

        const def = this.def(building);

        this.pay(cost);
        building.level++;
        building.buildStart = this.state.time;
        building.buildEnd =
            this.state.time + this.buildTime(this.levelDef(building));
        this.state.stats.upgraded++;
        this.changedBuildings.add(uid);

        if (!quiet) {
            this.structureChanged();
        }

        this.events.emit({
            type: 'upgraded',
            uid,
            x: building.x,
            y: building.y,
            w: def.size.w,
            h: def.size.h,
            sound: quiet ? null : def.sounds.upgrade,
        });

        return { ok: true };
    }

    /** Price to bring a building straight up to a higher level. */
    relevelCost(building: BuildingState, level: number): Amounts {
        const target = this.content.level(this.def(building), level);

        if (target.upgrade) {
            return target.upgrade;
        }

        const share = this.content.world.economy.upgradeShare ?? 0.7;

        return Object.fromEntries(
            Object.entries(target.cost).map(([id, amount]) => [
                id,
                Math.ceil(amount * share),
            ]),
        );
    }

    /**
     * Brings a finished building straight up to a higher open level in
     * one go — used when a road is laid over an older one.
     */
    relevel(uid: number, level: number, quiet = false): ActionResult {
        const building = this.buildings.get(uid);

        if (!building || level <= building.level) {
            return { ok: false };
        }

        const def = this.def(building);
        const reason = !this.isComplete(building)
            ? 'Идёт стройка'
            : this.levelLock(def, level);

        if (reason) {
            return quiet ? { ok: false, reason } : this.fail(reason);
        }

        const cost = this.relevelCost(building, level);

        if (!this.canAfford(cost)) {
            return quiet
                ? { ok: false, reason: this.missing(cost) }
                : this.fail(this.missing(cost));
        }

        this.pay(cost);
        building.level = level;
        building.buildStart = this.state.time;
        building.buildEnd =
            this.state.time + this.buildTime(this.levelDef(building));
        this.state.stats.upgraded++;
        this.changedBuildings.add(uid);

        if (!quiet) {
            this.structureChanged();
        }

        return { ok: true };
    }

    /** Upgrades every finished building of a type at a level, while money lasts. */
    upgradeAll(type: string, level: number): number {
        let done = 0;

        for (const building of [...this.buildings.values()]) {
            if (building.type === type && building.level === level) {
                if (this.upgrade(building.uid, true).ok) {
                    done++;
                } else if (!this.canAfford(this.upgradeCost(building))) {
                    break;
                }
            }
        }

        if (done) {
            this.structureChanged();
            this.events.emit({
                type: 'sound',
                id: this.content.building(type).sounds.upgrade ?? 'upgrade',
            });
        }

        return done;
    }

    demolish(uid: number): ActionResult {
        const building = this.buildings.get(uid);

        if (!building) {
            return { ok: false };
        }

        const def = this.def(building);

        if (def.role === 'center') {
            return this.fail('Центр города снести нельзя');
        }

        for (const [id, amount] of Object.entries(
            this.levelDef(building).cost,
        )) {
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

    research(id: string): ActionResult {
        const tech = this.content.tech(id);

        if (!tech) {
            return { ok: false };
        }

        const locked = this.techLock(tech);

        if (locked) {
            return this.fail(locked);
        }

        if (!this.canAfford(tech.cost)) {
            return this.fail(this.missing(tech.cost));
        }

        this.pay(tech.cost);
        this.state.research = {
            id,
            start: this.state.time,
            end: this.state.time + this.researchTime(tech),
        };
        this.revision++;
        this.events.emit({ type: 'sound', id: 'click' });

        return { ok: true };
    }

    unlockBlueprint(id: string): ActionResult {
        const blueprint = this.content.blueprint(id);

        if (!blueprint || this.state.blueprints.includes(id)) {
            return { ok: false };
        }

        const locked = this.blueprintLock(blueprint);

        if (locked) {
            return this.fail(locked);
        }

        if (!this.canAfford(blueprint.cost)) {
            return this.fail(this.missing(blueprint.cost));
        }

        this.pay(blueprint.cost);
        this.state.blueprints.push(id);
        this.revision++;
        this.events.emit({
            type: 'toast',
            text: `${blueprint.icon} Чертёж «${blueprint.name}» готов`,
            tone: 'good',
        });

        return { ok: true };
    }

    /** Dresses a building in a blueprint and/or own colours (null = as built). */
    setStyle(uid: number, style: BuildingStyle | null): ActionResult {
        const building = this.buildings.get(uid);

        if (!building) {
            return { ok: false };
        }

        if (style) {
            if (!this.bureau) {
                return this.fail('Нужно бюро архитекторов');
            }

            const blueprint = style.blueprint
                ? this.content.blueprint(style.blueprint)
                : undefined;

            if (
                style.blueprint &&
                (!blueprint ||
                    !this.state.blueprints.includes(style.blueprint) ||
                    !this.blueprintFits(blueprint, this.def(building)))
            ) {
                return this.fail('Этот чертёж сюда не подходит');
            }
        }

        building.style =
            style && (style.blueprint || Object.keys(style.colors).length)
                ? style
                : null;
        this.changedBuildings.add(uid);
        this.revision++;
        this.events.emit({ type: 'restyled', uid });

        return { ok: true };
    }

    setDistrict(
        uid: number,
        name: string,
        policy: string | null,
    ): ActionResult {
        const building = this.buildings.get(uid);

        if (!building || this.def(building).role !== 'district') {
            return { ok: false };
        }

        building.district = {
            name: name.trim().slice(0, 40) || this.districtName(),
            policy,
        };
        this.changedBuildings.add(uid);
        this.structureChanged();

        return { ok: true };
    }

    advanceEpoch(): ActionResult {
        const next = this.epoch.next;

        if (!next || !this.canAdvance()) {
            return this.fail('Условия ещё не выполнены');
        }

        this.pay(next.cost);
        this.state.epoch++;
        this.state.year = this.epoch.year;
        this.npcs.onEpochChanged();
        this.structureChanged();
        this.events.emit({ type: 'epoch', epoch: this.state.epoch });

        return { ok: true };
    }

    // ———————————————————————————————————————— Simulation

    tick(dt: number, quiet = false): void {
        const state = this.state;
        const before = this.season.id;

        state.time += dt;
        state.year = Math.min(
            (this.content.epochs[state.epoch + 1]?.year ?? 3999) - 1,
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

                if (!quiet && this.def(building).role !== 'road') {
                    this.events.emit({ type: 'built', uid: building.uid });
                }
            }
        }

        this.updateResearch(quiet);

        if (this.structureDirty) {
            this.recalculate();
        }

        this.updateEconomy(dt);
        this.updatePopulation(dt);
        this.updateGoals(quiet);

        if (state.time >= state.nextEventAt) {
            this.randomEvent(quiet);
        }

        this.npcs.think(quiet);

        if (this.infinite) {
            this.testerGrant();
        }

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
            tourism: 0,
        };
    }

    private collectBonuses(): Bonuses {
        const bonuses: Bonuses = {
            produces: {},
            happiness: 0,
            housing: 0,
            storage: 0,
            buildSpeed: 0,
            tax: 0,
            research: 0,
        };

        for (const id of this.state.techs) {
            const bonus: TechBonus | null | undefined =
                this.content.tech(id)?.bonus;

            if (!bonus) {
                continue;
            }

            for (const [resource, percent] of Object.entries(
                bonus.produces ?? {},
            )) {
                bonuses.produces[resource] =
                    (bonuses.produces[resource] ?? 0) + percent;
            }

            bonuses.happiness += bonus.happiness ?? 0;
            bonuses.housing += bonus.housing ?? 0;
            bonuses.storage += bonus.storage ?? 0;
            bonuses.buildSpeed += bonus.buildSpeed ?? 0;
            bonuses.tax += bonus.tax ?? 0;
            bonuses.research += bonus.research ?? 0;
        }

        return bonuses;
    }

    private fail(reason: string): ActionResult {
        this.events.emit({ type: 'error', text: reason });

        return { ok: false, reason };
    }

    private pay(cost: Amounts): void {
        if (this.infinite) {
            return;
        }

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

    private underConstruction(type: string): number {
        let count = 0;

        for (const building of this.buildings.values()) {
            count +=
                building.type === type && !this.isComplete(building) ? 1 : 0;
        }

        return count;
    }

    private districtName(): string {
        const names = [
            'Заречье',
            'Слобода',
            'Посад',
            'Подгорье',
            'Луговой',
            'Северный',
            'Южный',
            'Старый город',
            'Новый квартал',
            'Приозёрный',
            'Кленовый',
            'Солнечный',
        ];
        const taken = new Set(
            this.districtHalls().map((hall) => hall.district?.name),
        );

        return (
            names.find((name) => !taken.has(name)) ??
            `Округ ${this.districtHalls().length + 1}`
        );
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
            style: null,
            district: null,
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

    /** Roads start from the town centre and from every district hall. */
    private isRoot(building: BuildingState): boolean {
        const role = this.def(building).role;

        return role === 'center' || role === 'district';
    }

    isConnected(building: BuildingState): boolean {
        const def = this.def(building);

        if (def.role === 'road') {
            return this.connectedRoads.has(
                this.map.index(building.x, building.y),
            );
        }

        if (!def.placement.requiresRoad || this.isRoot(building)) {
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
                (neighbour && this.isRoot(neighbour))
            ) {
                return true;
            }
        }

        return false;
    }

    private findConnectedRoads(): void {
        const connected = new Set<number>();
        const queue: number[] = [];

        for (const root of this.buildings.values()) {
            if (!this.isRoot(root)) {
                continue;
            }

            const { w, h } = this.def(root).size;

            for (const [x, y] of this.around(root.x, root.y, w, h, 1)) {
                const index = this.map.index(x, y);

                if (this.isRoad(index) && !connected.has(index)) {
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
     * upgraded or cleared: road connections, districts, terrain and boost
     * bonuses, and how pleasant each home's surroundings are.
     */
    private recalculate(): void {
        this.structureDirty = false;
        this.findConnectedRoads();

        const all = [...this.buildings.values()];
        const working = all.filter(
            (b) => this.isComplete(b) && this.isConnected(b),
        );
        const status = new Map<number, BuildingStatus>();
        const districtOf = new Map<number, BuildingState | undefined>();

        for (const building of all) {
            const def = this.def(building);

            districtOf.set(
                building.uid,
                def.role === 'district'
                    ? building
                    : this.districtAt(
                          building.x + Math.floor(def.size.w / 2),
                          building.y + Math.floor(def.size.h / 2),
                      ),
            );
        }

        for (const building of all) {
            const def = this.def(building);
            const effects = this.effects(building);
            const hall = districtOf.get(building.uid);
            const policy = this.policyOf(hall)?.effects ?? NO_POLICY;
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
                    const sourcePolicy =
                        this.policyOf(districtOf.get(other.uid))?.effects ??
                        NO_POLICY;

                    pollution +=
                        otherEffects.pollution.amount *
                        Math.max(0, 1 + (sourcePolicy.pollution ?? 0) / 100);
                }
            }

            if (effects.housing && def.role !== 'center') {
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
                    Math.min(services, 55) +
                    (policy.happiness ?? 0) -
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
                district: hall?.uid ?? null,
                output: {},
                input: {},
            });
        }

        this.status = status;
    }

    private policyEffects(
        status: BuildingStatus,
    ): DistrictPolicyDef['effects'] {
        return status.district
            ? (this.policyOf(this.buildings.get(status.district))?.effects ??
                  NO_POLICY)
            : NO_POLICY;
    }

    private housingOf(building: BuildingState, status: BuildingStatus): number {
        const housing = this.effects(building).housing;

        if (!housing) {
            return 0;
        }

        return Math.floor(
            housing *
                (1 +
                    (this.bonuses.housing +
                        (this.policyEffects(status).housing ?? 0)) /
                        100),
        );
    }

    private updateEconomy(dt: number): void {
        const content = this.content;
        const rules = content.world;
        const state = this.state;
        const stats = this.emptyStats();
        const season = this.season;
        const weatherFertility = this.weather?.fertility ?? 1;
        const active: BuildingState[] = [];
        let storage = rules.economy.storageBase;

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
            stats.housing += this.housingOf(building, status);
            stats.jobs += effects.jobs;
            stats.powerSupply += effects.power;
            stats.powerDemand += effects.powerUse;
            stats.defense += effects.defense;
            storage += effects.storage;
        }

        storage *= 1 + this.bonuses.storage / 100;

        for (const resource of content.resources) {
            stats.caps[resource.id] = resource.capped ? storage : Infinity;
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
            const policy = this.policyEffects(status);
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
                const percent =
                    (this.bonuses.produces[id] ?? 0) +
                    (this.bonuses.produces['*'] ?? 0) +
                    (policy.produces?.[id] ?? 0) +
                    (policy.produces?.['*'] ?? 0);
                const perSecond =
                    (amount + nearby) *
                    (1 + status.boost) *
                    Math.max(0, 1 + percent / 100) *
                    seasonal *
                    efficiency;

                status.output[id] = perSecond;
                stats.rates[id] = (stats.rates[id] ?? 0) + perSecond;
                state.resources[id] =
                    (state.resources[id] ?? 0) + perSecond * dt;
            }

            // Old buildings in a district that welcomes tourists.
            if (policy.tourism && this.def(building).role !== 'road') {
                const age = state.epoch - this.levelEpoch(building);

                if (age > 0) {
                    const gold = policy.tourism * age;

                    status.output.gold = (status.output.gold ?? 0) + gold;
                    stats.rates.gold = (stats.rates.gold ?? 0) + gold;
                    stats.tourism += gold;
                    state.resources.gold =
                        (state.resources.gold ?? 0) + gold * dt;
                }
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
            const housing = this.housingOf(building, status);

            if (status.happiness === null) {
                continue;
            }

            let happiness = status.happiness - cold + this.bonuses.happiness;

            if (effects.powerUse) {
                happiness -= (1 - powerRatio) * rules.population.noPowerPenalty;
            }

            status.residents = Math.floor(housing * fill);
            weighted += happiness * housing;
            weight += housing;
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
            (0.5 + this.stats.happiness / 100) *
            (1 + this.bonuses.tax / 100);
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

    private updateResearch(quiet: boolean): void {
        const research = this.state.research;

        if (!research || this.state.time < research.end) {
            return;
        }

        this.state.research = null;

        if (!this.hasTech(research.id)) {
            this.state.techs.push(research.id);
        }

        this.bonuses = this.collectBonuses();
        this.structureDirty = true;

        const tech = this.content.tech(research.id);

        this.events.emit({ type: 'researched', tech: research.id });

        if (!quiet) {
            this.events.emit({
                type: 'toast',
                text: `${tech?.icon ?? '🔬'} Изучено: ${tech?.name ?? research.id}`,
                tone: 'good',
            });
        }
    }

    private updateGoals(quiet: boolean): void {
        for (const goal of this.content.goals) {
            if (
                this.state.achievements.includes(goal.id) ||
                this.content.epochOrder(goal.epoch) > this.state.epoch ||
                !this.goalProgress(goal).done
            ) {
                continue;
            }

            this.state.achievements.push(goal.id);
            this.gain(goal.reward);
            this.events.emit({ type: 'achievement', goal: goal.id });

            if (!quiet) {
                const reward = Object.entries(goal.reward)
                    .map(
                        ([id, amount]) =>
                            `+${amount} ${this.content.resource(id)?.icon ?? id}`,
                    )
                    .join(' ');

                this.events.emit({
                    type: 'toast',
                    text: `🏆 ${goal.name}${reward ? ` · ${reward}` : ''}`,
                    tone: 'good',
                });
            }
        }
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

    // ———————————————————————————————————————— Tester tools

    /** Tester: fills every known resource (capped ones to the brim). */
    testerGrant(): void {
        for (const resource of this.visibleResources()) {
            const cap = this.stats.caps[resource.id];

            this.state.resources[resource.id] = Number.isFinite(cap)
                ? cap
                : (this.state.resources[resource.id] ?? 0) + 100_000;
        }

        this.revision++;
    }

    /** Tester: finishes all construction and the research under way. */
    testerFinish(): void {
        for (const building of this.buildings.values()) {
            if (!this.isComplete(building)) {
                building.buildEnd = this.state.time;
                building.buildStart = Math.min(
                    building.buildStart,
                    this.state.time,
                );
                this.changedBuildings.add(building.uid);
            }
        }

        if (this.state.research) {
            this.state.research.end = this.state.time;
            this.updateResearch(false);
        }

        this.structureChanged();
    }

    /** Tester: researches every technology of the eras reached so far. */
    testerResearchAll(): void {
        for (const tech of this.content.techs) {
            if (
                this.content.epochOrder(tech.epoch) <= this.state.epoch &&
                !this.hasTech(tech.id)
            ) {
                this.state.techs.push(tech.id);
            }
        }

        this.state.research = null;
        this.bonuses = this.collectBonuses();
        this.structureChanged();
    }

    /** Tester: moves to the next era whatever the checklist says. */
    testerNextEpoch(): void {
        if (!this.epoch.next) {
            return;
        }

        this.state.epoch++;
        this.state.year = this.epoch.year;
        this.npcs.onEpochChanged();
        this.structureChanged();
        this.events.emit({ type: 'epoch', epoch: this.state.epoch });
    }

    randomName(): string {
        const names = this.content.bundle.npcs.names;

        return `${pick(this.rng, names.first)} ${pick(this.rng, names.last)}`;
    }

    random(): number {
        return this.rng();
    }

    /** A stable 0..1 number per building, for looks. */
    noise(building: BuildingState, salt = 0): number {
        return hash2(building.uid, building.x + building.y, salt);
    }
}
