/**
 * The simulation facade. Owns the world state, the map and the buildings,
 * runs the systems once per game second (time & weather, construction,
 * research, economy, population, goals, events, NPC decisions) and exposes
 * the player's actions. Every number it uses comes from the content files.
 *
 * Content rates are per game year; each game second the engine applies
 * `rate / secondsPerYear`. There is one currency, `money` (world.json
 * economy.currency); construction prices are money plus materials, and the
 * materials a construction lacks are bought for money on the spot.
 *
 * Nothing changes by itself when an era begins: a building keeps the level
 * (and so the look) the player gave it. Eras only open new levels,
 * discoveries and resources.
 */

import { MATERIALS, SERVICES } from '../content/registry';
import type { BuildingRole, Content } from '../content/registry';
import type {
    Amounts,
    BlueprintDef,
    BuildingDef,
    DistrictPolicyDef,
    Effects,
    EpochDef,
    GoalDef,
    LevelDef,
    Palette,
    RoofShape,
    ServiceId,
    TechBonus,
    TechDef,
} from '../content/types';
import { Clock } from '../core/clock';
import { EventBus } from '../core/events';
import { between, hash2, mulberry32, pick, weighted } from '../core/random';
import type { Rng } from '../core/random';
import { buildMap, mapLayout } from '../world/layout';
import type { MapLayout } from '../world/layout';
import type { WorldMap } from '../world/world-map';
import { NpcSystem } from './npcs';
import type {
    ActionResult,
    BuildingState,
    BuildingStyle,
    NpcState,
    WorldState,
} from './state';

/** What one building is doing right now. Rates are per year. */
export interface BuildingStatus {
    complete: boolean;
    connected: boolean;
    efficiency: number;
    starved: string | null;
    noPower: boolean;
    boost: number;
    happiness: number | null;
    pollution: number;
    /** Homes: the services that reach them. */
    services: ServiceId[];
    /** Homes: the share of the era's home services that reach them, 0..1. */
    comfort: number;
    residents: number;
    workers: number;
    /** The district hall whose district it stands in. */
    district: number | null;
    output: Amounts;
    input: Amounts;
}

/** The city's numbers right now. Rates are per year. */
export interface Stats {
    rates: Amounts;
    caps: Amounts;
    /** Places in homes. */
    housing: number;
    /**
     * How many citizens the homes hold at their happiness (P*): homes
     * fill with comfort (services) and happiness (occupancy).
     */
    target: number;
    jobs: number;
    workers: number;
    employment: number;
    powerSupply: number;
    powerDemand: number;
    happiness: number;
    starving: boolean;
    /** Money per year from taxes. */
    tax: number;
    /** Housing-weighted tax multiplier of the homes' level eras. */
    taxMult: number;
    /** Money per year from old buildings in historic districts. */
    tourism: number;
    /** Percent faster research from schools and the like. */
    research: number;
}

/** Every researched discovery's bonus added up. */
export interface Bonuses {
    produces: Record<string, number>;
    happiness: number;
    housing: number;
    tax: number;
    trade: number;
    research: number;
    traffic: number;
}

export interface GoalProgress {
    current: number;
    target: number;
    done: boolean;
}

/**
 * A price as it will be paid: its money, its materials — those in stock
 * and those bought for money because the stores lack them — and the money
 * in all.
 */
export interface Quote {
    money: number;
    mat: number;
    fromStock: number;
    bought: number;
    importMoney: number;
    total: number;
}

/** One line of the gate into the next era. */
export interface GateLine {
    label: string;
    done: boolean;
    current?: number;
    target?: number;
    /** The Town Hall upgrade that opens the era. */
    cost?: Amounts;
}

const NO_POLICY: DistrictPolicyDef['effects'] = {};

export class Game {
    readonly content: Content;
    readonly events = new EventBus();
    readonly clock: Clock;
    /** The fixed map's bands (land, beach, sea). */
    readonly layout: MapLayout;
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
        this.layout = mapLayout(content);
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

    /** A new world on the fixed map; the seed only drives events and names. */
    static create(
        content: Content,
        seed = Math.floor(Math.random() * 2 ** 31),
    ): Game {
        const world = content.world;
        const map = buildMap(content);
        const epoch = Math.max(
            0,
            content.epochs.findIndex((e) => e.id === world.start.epoch),
        );
        const state: WorldState = {
            seed,
            width: map.width,
            height: map.height,
            epoch,
            time: 0,
            land: { ...world.map.start },
            resources: { ...content.emptyAmounts(), ...world.start.resources },
            population: world.start.population,
            weather: content.weather[0]?.id ?? 'clear',
            weatherUntil: 0,
            nextEventAt: world.events.firstYear * world.time.secondsPerYear,
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
                          Math.floor(world.map.landRows / 2 - def.size.h / 2),
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

    /** The current era's palette (interface); buildings use their own. */
    get palette() {
        return this.content.epoch(this.state.epoch).palette;
    }

    /** The calendar year: game time at one constant rate, from year 0. */
    get year(): number {
        return this.clock.year(this.state.time);
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

    /** The Town Hall. */
    get center(): BuildingState | undefined {
        for (const building of this.buildings.values()) {
            if (this.roleOf(building) === 'center') {
                return building;
            }
        }

        return undefined;
    }

    /** The Architects' Bureau, once it stands. */
    get bureau(): BuildingState | undefined {
        for (const building of this.buildings.values()) {
            if (
                this.roleOf(building) === 'bureau' &&
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

    /** What the engine does specially with a building, if anything. */
    roleOf(building: BuildingState): BuildingRole | null {
        return this.content.roleOf(this.def(building));
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

        return building !== undefined && this.roleOf(building) === 'road';
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

    /**
     * The player's land as an inclusive tile rect: the owned columns, over
     * the full depth of the land and the beach (the sea is nobody's yet).
     */
    territory(): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        return {
            minX: this.state.land.minX,
            minY: 0,
            maxX: this.state.land.maxX,
            maxY: this.layout.seaY - 1,
        };
    }

    inTerritory(x: number, y: number): boolean {
        const t = this.territory();

        return x >= t.minX && y >= t.minY && x <= t.maxX && y <= t.maxY;
    }

    /** Sets the owned columns (expansion strips are bought through this later). */
    setLand(minX: number, maxX: number): ActionResult {
        const width = this.map.width;
        const from = Math.max(0, Math.min(width - 1, Math.floor(minX)));
        const to = Math.max(0, Math.min(width - 1, Math.floor(maxX)));

        if (from > to) {
            return { ok: false, reason: 'Пустая полоса земли' };
        }

        this.state.land = { minX: from, maxX: to };
        this.revision++;

        return { ok: true };
    }

    /** Money in the treasury. */
    get money(): number {
        return this.state.resources[this.content.currency] ?? 0;
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
            return `Нужно открытие «${this.content.tech(levelDef.tech)?.name ?? levelDef.tech}»`;
        }

        const requires = levelDef.requires;

        if (
            requires?.population &&
            this.state.population < requires.population
        ) {
            return `Нужно ${requires.population} жителей`;
        }

        if (
            requires?.townHallLevel &&
            (this.center?.level ?? 0) < requires.townHallLevel
        ) {
            return `Нужна ратуша уровня ${requires.townHallLevel}`;
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
        return this.def(building).levels[building.level]
            ? this.relevelCost(building, building.level + 1)
            : {};
    }

    /**
     * Price to bring a building up to a higher level: the new level's
     * price, less a share of the current level's (trade-in), but never
     * below the floor share of the new price — money and materials alike.
     */
    relevelCost(building: BuildingState, level: number): Amounts {
        const economy = this.content.world.economy;
        const money = this.content.currency;
        const target = this.content.level(this.def(building), level).cost;
        const current = this.levelDef(building).cost[money] ?? 0;
        const targetMoney = target[money] ?? 0;
        const share =
            targetMoney > 0
                ? Math.max(
                      economy.upgradeFloor,
                      1 -
                          (economy.tradeIn * Math.min(current, targetMoney)) /
                              targetMoney,
                  )
                : 1;

        return Object.fromEntries(
            Object.entries(target).map(([id, amount]) => [
                id,
                id === money
                    ? Math.ceil(amount * share - 1e-9)
                    : Math.round(amount * share * 10) / 10,
            ]),
        );
    }

    buildTime(level: LevelDef): number {
        return level.buildTime;
    }

    moveCost(building: BuildingState): Amounts {
        const money = this.content.currency;

        return {
            [money]: Math.ceil(
                (this.levelDef(building).cost[money] ?? 0) *
                    this.content.world.economy.moveShare,
            ),
        };
    }

    /** How a price will be paid, with the materials the stores lack bought for money. */
    quote(cost: Amounts): Quote {
        const money = cost[this.content.currency] ?? 0;
        const mat = cost[MATERIALS] ?? 0;
        const stock = Math.max(0, this.state.resources[MATERIALS] ?? 0);
        const fromStock = Math.min(mat, stock);
        const bought = Math.max(0, mat - fromStock);
        const importMoney =
            bought > 1e-9
                ? Math.ceil(
                      bought * this.content.world.economy.prices.matImport -
                          1e-9,
                  )
                : 0;

        return {
            money,
            mat,
            fromStock,
            bought,
            importMoney,
            total: money + importMoney,
        };
    }

    canAfford(cost: Amounts): boolean {
        if (this.infinite) {
            return true;
        }

        const others = Object.entries(cost).filter(
            ([id]) => id !== this.content.currency && id !== MATERIALS,
        );

        return (
            this.money >= this.quote(cost).total - 1e-6 &&
            others.every(
                ([id, amount]) =>
                    (this.state.resources[id] ?? 0) >= amount - 1e-6,
            )
        );
    }

    missing(cost: Amounts): string {
        if (this.canAfford(cost)) {
            return '';
        }

        const quote = this.quote(cost);

        return this.money < quote.total - 1e-6
            ? quote.importMoney > 0
                ? 'Не хватает денег (с докупкой стройматериалов)'
                : 'Не хватает денег'
            : 'Не хватает ресурсов';
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
            : !def.hidden && !this.content.roleOf(def);
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
            (b) => this.roleOf(b) === 'district',
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
            return 'Сделано';
        }

        if (this.content.epochOrder(tech.epoch) > this.state.epoch) {
            return `Эпоха «${this.content.epochById(tech.epoch).name}»`;
        }

        const missing = tech.requires.filter((id) => !this.hasTech(id));

        if (missing.length) {
            return `Сначала: ${missing.map((id) => this.content.tech(id)?.name ?? id).join(', ')}`;
        }

        if (this.state.research) {
            return 'Идёт другое открытие';
        }

        return null;
    }

    /** Game seconds a discovery takes: faster with schools and research bonuses (up to ×2.5). */
    researchTime(tech: TechDef): number {
        const percent = this.stats.research + this.bonuses.research;

        return tech.time / (1 + Math.min(1.5, Math.max(0, percent) / 100));
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
                current = ([] as string[])
                    .concat(condition.building)
                    .reduce(
                        (sum, type) =>
                            sum + this.count(type, condition.level ?? 1),
                        0,
                    );
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
            case 'happiness':
                current =
                    state.population >= 10
                        ? Math.round(this.stats.happiness)
                        : 0;
                target = condition.value;
                break;
            case 'coverage': {
                const { tiles, covered } = this.homeCoverage(condition.service);

                target = Math.round(condition.share * 100);
                current =
                    tiles >= condition.minTiles
                        ? Math.floor((covered / tiles) * 100 + 1e-9)
                        : 0;
                break;
            }
            case 'power':
                current = Math.floor(this.stats.powerSupply);
                target = condition.value;
                break;
            case 'heritage':
                current = [...this.buildings.values()].filter(
                    (b) =>
                        this.def(b).heritage &&
                        this.isComplete(b) &&
                        state.epoch - this.levelEpoch(b) >=
                            (condition.age ?? 2),
                ).length;
                target = condition.count;
                break;
            default:
                // Conditions of systems that come later (stars, strips, …).
                current = 0;
                target = 1;
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

    /** The next era, if there is one. */
    get nextEpoch(): EpochDef | undefined {
        return this.content.epochs[this.state.epoch + 1];
    }

    /** The Town Hall level whose completion opens the next era, and its price. */
    townHallUpgrade(): { level: LevelDef; cost: Amounts } | null {
        const entry = this.nextEpoch?.entry;
        const def = this.content.byRole('center');
        const level =
            entry && def ? def.levels[entry.townHallLevel - 1] : undefined;

        return level ? { level, cost: level.cost } : null;
    }

    /**
     * The gate into the next era (epochs.json entry): citizens, the
     * buildings it asks for, discoveries of this era, and the price of the
     * Town Hall upgrade that opens it.
     */
    epochChecklist(): GateLine[] {
        const entry = this.nextEpoch?.entry;
        const upgrade = this.townHallUpgrade();

        if (!entry || !upgrade) {
            return [];
        }

        const discoveries = this.content.techs.filter(
            (tech) => tech.epoch === this.epoch.id && this.hasTech(tech.id),
        ).length;
        const lines: GateLine[] = [
            {
                label: 'Жители',
                current: Math.floor(this.state.population),
                target: entry.population,
                done: this.state.population >= entry.population,
            },
        ];

        for (const item of entry.items) {
            const have = this.count(item.type, item.level);

            lines.push({
                label: item.label,
                current: Math.min(have, item.count),
                target: item.count,
                done: have >= item.count,
            });
        }

        lines.push({
            label: `Открытия эпохи «${this.epoch.name}»`,
            current: Math.min(discoveries, entry.discoveries),
            target: entry.discoveries,
            done: discoveries >= entry.discoveries,
        });
        lines.push({
            label: `Ратуша → «${upgrade.level.name}»`,
            cost: upgrade.cost,
            done: this.canAfford(upgrade.cost),
        });

        return lines;
    }

    canAdvance(): boolean {
        const list = this.epochChecklist();

        return list.length > 0 && list.every((item) => item.done);
    }

    score(): number {
        let levels = 0;

        for (const building of this.buildings.values()) {
            levels += this.roleOf(building) === 'road' ? 0 : building.level;
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

                const occupant = this.map.occupantAt(tx, ty);

                if (occupant && occupant !== ignoreUid) {
                    return { ok: false, reason: 'Место занято' };
                }
            }
        }

        const zone = this.zoneReason(def, y);

        return zone ? { ok: false, reason: zone } : { ok: true };
    }

    /**
     * Why a footprint whose top row is `y` is out of its building's zone
     * (gdd §5.1): land rows, land or beach, the mountain foot (rows 0–1),
     * the waterline (the last beach row). Deposit spots come with the land
     * slice; until then any mountain-foot place will do.
     */
    zoneReason(def: BuildingDef, y: number): string | null {
        const bottom = y + def.size.h - 1;
        const waterline = this.layout.seaY - 1;

        switch (def.placement.zone) {
            case 'land':
                return bottom < this.layout.beachY
                    ? null
                    : 'Это здание ставят на суше, не на пляже';
            case 'landOrBeach':
                return bottom < waterline
                    ? null
                    : 'У самой воды ставят только причалы';
            case 'coast':
                return bottom === waterline
                    ? null
                    : 'Ставится у самой кромки воды';
            case 'mountain':
                return y === 0
                    ? null
                    : 'Ставится у подножия гор — вплотную к ним';
            default:
                return 'Такое здание пока нельзя поставить';
        }
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

        if (this.content.roleOf(def) === 'district') {
            building.district = {
                name: this.districtName(),
                policy: null,
            };
        }

        this.state.stats.built += this.content.roleOf(def) === 'road' ? 0 : 1;
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

        if (this.content.roleOf(def) === 'center') {
            return this.fail('Ратушу снести нельзя');
        }

        // Money only: half the current level's price.
        this.gain({
            [this.content.currency]: Math.floor(
                (this.levelDef(building).cost[this.content.currency] ?? 0) *
                    this.content.world.economy.refundShare,
            ),
        });

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

        const cost = this.moveCost(building);

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

        if (!building || this.roleOf(building) !== 'district') {
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

    /**
     * Enters the next era once its gate is met: pays the Town Hall
     * upgrade and raises the Town Hall to the era's level at once (the
     * visible build and the Chronicle come with the eras slice).
     */
    advanceEpoch(): ActionResult {
        const upgrade = this.townHallUpgrade();

        if (!upgrade || !this.canAdvance()) {
            return this.fail('Условия ещё не выполнены');
        }

        this.pay(upgrade.cost);
        this.enterNextEpoch();

        return { ok: true };
    }

    private enterNextEpoch(): void {
        const entry = this.nextEpoch?.entry;
        const center = this.center;

        if (!entry) {
            return;
        }

        if (center && center.level < entry.townHallLevel) {
            center.level = entry.townHallLevel;
            center.buildStart = this.state.time;
            center.buildEnd = this.state.time;
            this.changedBuildings.add(center.uid);
        }

        this.state.epoch++;
        this.npcs.onEpochChanged();
        this.structureChanged();
        this.events.emit({ type: 'epoch', epoch: this.state.epoch });
    }

    // ———————————————————————————————————————— Simulation

    tick(dt: number, quiet = false): void {
        const state = this.state;
        const before = this.season.id;

        state.time += dt;
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

                if (!quiet && this.roleOf(building) !== 'road') {
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
            target: 0,
            jobs: 0,
            workers: 0,
            employment: 1,
            powerSupply: 0,
            powerDemand: 0,
            happiness: 50,
            starving: false,
            tax: 0,
            taxMult: 1,
            tourism: 0,
            research: 0,
        };
    }

    private collectBonuses(): Bonuses {
        const bonuses: Bonuses = {
            produces: {},
            happiness: 0,
            housing: 0,
            tax: 0,
            trade: 0,
            research: 0,
            traffic: 0,
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
            bonuses.tax += bonus.tax ?? 0;
            bonuses.trade += bonus.trade ?? 0;
            bonuses.research += bonus.research ?? 0;
            bonuses.traffic += bonus.traffic ?? 0;
        }

        return bonuses;
    }

    private fail(reason: string): ActionResult {
        this.events.emit({ type: 'error', text: reason });

        return { ok: false, reason };
    }

    /** Pays a price: materials from the stores, what they lack bought for money. */
    private pay(cost: Amounts): void {
        if (this.infinite) {
            return;
        }

        const money = this.content.currency;
        const quote = this.quote(cost);
        const resources = this.state.resources;

        for (const [id, amount] of Object.entries(cost)) {
            if (id !== money && id !== MATERIALS) {
                resources[id] = Math.max(0, (resources[id] ?? 0) - amount);
            }
        }

        resources[MATERIALS] = Math.max(
            0,
            (resources[MATERIALS] ?? 0) - quote.fromStock,
        );
        resources[money] = Math.max(0, (resources[money] ?? 0) - quote.total);
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
        const role = this.roleOf(building);

        return role === 'center' || role === 'district';
    }

    isConnected(building: BuildingState): boolean {
        const def = this.def(building);

        if (this.content.roleOf(def) === 'road') {
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

    /** Tiles between two footprints along the grid (0 when touching): coverage diamonds. */
    private manhattan(a: BuildingState, b: BuildingState): number {
        const sa = this.def(a).size;
        const sb = this.def(b).size;
        const dx = Math.max(0, a.x - (b.x + sb.w - 1), b.x - (a.x + sa.w - 1));
        const dy = Math.max(0, a.y - (b.y + sb.h - 1), b.y - (a.y + sa.h - 1));

        return dx + dy;
    }

    /**
     * The home services (water, leisure, health, education) some building
     * of an era reached so far provides; happiness counts the share of
     * these a home gets.
     */
    unlockedServices(): ServiceId[] {
        const found = new Set<ServiceId>();

        for (const def of this.content.buildings) {
            for (const level of def.levels) {
                const service = level.effects.coverage?.service;

                if (
                    service &&
                    service !== 'data' &&
                    this.content.epochOrder(level.epoch) <= this.state.epoch
                ) {
                    found.add(service);
                }
            }
        }

        return SERVICES.filter((service) => found.has(service));
    }

    /** Home tiles in all, and how many of them a service reaches. */
    homeCoverage(service: ServiceId): { tiles: number; covered: number } {
        let tiles = 0;
        let covered = 0;

        for (const building of this.buildings.values()) {
            const status = this.status.get(building.uid);

            if (!status?.complete || status.happiness === null) {
                continue;
            }

            const { w, h } = this.def(building).size;

            tiles += w * h;
            covered += status.services.includes(service) ? w * h : 0;
        }

        return { tiles, covered };
    }

    /**
     * Everything that only changes when something is built, moved,
     * upgraded or removed: road connections, districts, boosts, and how
     * pleasant each home's surroundings are: the services that reach it,
     * the auras around it and the pollution.
     */
    private recalculate(): void {
        this.structureDirty = false;
        this.findConnectedRoads();

        const rules = this.content.world.happiness;
        const all = [...this.buildings.values()];
        const working = all.filter(
            (b) => this.isComplete(b) && this.isConnected(b),
        );
        const unlocked = this.unlockedServices();
        const status = new Map<number, BuildingStatus>();
        const districtOf = new Map<number, BuildingState | undefined>();

        for (const building of all) {
            const def = this.def(building);

            districtOf.set(
                building.uid,
                this.content.roleOf(def) === 'district'
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
            const home =
                effects.housing > 0 && this.content.roleOf(def) !== 'center';
            const services = new Set<ServiceId>();
            let boost = 0;
            let happiness: number | null = null;
            let pollution = 0;
            let auras = 0;

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

                if (!home || other.uid === building.uid) {
                    continue;
                }

                if (otherEffects.aura && distance <= otherEffects.aura.radius) {
                    auras += otherEffects.aura.happiness;
                }

                const coverage = otherEffects.coverage;

                if (
                    coverage &&
                    this.manhattan(building, other) <= coverage.radius
                ) {
                    services.add(coverage.service);
                }
            }

            const covered = unlocked.filter((s) => services.has(s)).length;
            const comfort = unlocked.length ? covered / unlocked.length : 1;

            if (home) {
                happiness =
                    rules.base +
                    rules.comfort * comfort +
                    Math.min(rules.auraCap, auras) -
                    Math.min(rules.pollutionCap, pollution) +
                    (policy.happiness ?? 0);
            }

            status.set(building.uid, {
                complete: this.isComplete(building),
                connected: this.isConnected(building),
                efficiency: 0,
                starved: null,
                noPower: false,
                boost,
                happiness,
                pollution,
                services: [...services],
                comfort,
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

    /**
     * One step (dt game seconds) of the economy. Content rates are per
     * year, so each is applied as rate × dt / secondsPerYear; the stats
     * keep the yearly rates for the interface.
     */
    private updateEconomy(dt: number): void {
        const content = this.content;
        const rules = content.world;
        const economy = rules.economy;
        const money = content.currency;
        const state = this.state;
        const stats = this.emptyStats();
        const year = dt / this.clock.secondsPerYear;
        const active: BuildingState[] = [];
        let storage = economy.storageBase;

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
            storage += effects.storage;
        }

        for (const resource of content.resources) {
            stats.caps[resource.id] = content.isStored(resource.id)
                ? storage
                : Infinity;
        }

        stats.workers = state.population * economy.workforceShare;
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
                const need = amount * efficiency * year;

                if (need > 0 && (state.resources[id] ?? 0) < need) {
                    efficiency *= (state.resources[id] ?? 0) / need;
                    status.starved = id;
                }
            }

            status.efficiency = efficiency;
            stats.research += effects.research * efficiency;

            for (const [id, amount] of Object.entries(effects.consumes)) {
                const perYear = amount * efficiency;

                status.input[id] = perYear;
                stats.rates[id] = (stats.rates[id] ?? 0) - perYear;
                state.resources[id] = Math.max(
                    0,
                    (state.resources[id] ?? 0) - perYear * year,
                );
            }

            for (const [id, amount] of Object.entries(effects.produces)) {
                const percent =
                    (this.bonuses.produces[id] ?? 0) +
                    (this.bonuses.produces['*'] ?? 0) +
                    (policy.produces?.[id] ?? 0) +
                    (policy.produces?.['*'] ?? 0);
                const perYear =
                    amount *
                    (1 + status.boost) *
                    Math.max(0, 1 + percent / 100) *
                    efficiency;

                status.output[id] = perYear;
                stats.rates[id] = (stats.rates[id] ?? 0) + perYear;
                state.resources[id] =
                    (state.resources[id] ?? 0) + perYear * year;
            }

            // Old buildings in a district that welcomes tourists.
            if (policy.tourism && this.roleOf(building) !== 'road') {
                const age = state.epoch - this.levelEpoch(building);

                if (age > 0) {
                    const perYear = policy.tourism * age;

                    status.output[money] =
                        (status.output[money] ?? 0) + perYear;
                    stats.tourism += perYear;
                }
            }
        }

        // Happiness of every home, how full it gets (P*), and the tax
        // multiplier of the homes' level eras.
        const multipliers = economy.taxMultByLevelEra;
        const people = rules.population;
        const noPower = rules.happiness.noPower * (1 - powerRatio);
        const moods = state.moods.reduce((sum, mood) => sum + mood.amount, 0);
        const hunger = this.stats.starving ? rules.happiness.starving : 0;
        const fill = Math.min(1, state.population / Math.max(1, stats.housing));
        let weighted = 0;
        let weight = 0;
        let taxWeighted = 0;

        for (const building of active) {
            const status = this.status.get(building.uid)!;
            const effects = this.effects(building);
            const housing = this.housingOf(building, status);

            if (housing) {
                taxWeighted +=
                    housing *
                    (multipliers[this.levelEpoch(building)] ??
                        multipliers.at(-1) ??
                        1) *
                    this.def(building).taxMult;
            }

            if (status.happiness === null) {
                // The Town Hall's own rooms are always lived in.
                stats.target += housing;
                continue;
            }

            let happiness = status.happiness + this.bonuses.happiness;

            if (effects.powerUse) {
                happiness -= noPower;
            }

            const occupancy = Math.max(
                0,
                Math.min(
                    1,
                    (happiness + moods - hunger - people.occupancy.from) /
                        people.occupancy.span,
                ),
            );

            stats.target +=
                housing *
                (people.comfortFill[0] +
                    people.comfortFill[1] * status.comfort) *
                occupancy;
            status.residents = Math.floor(housing * fill);
            weighted += happiness * housing;
            weight += housing;
        }

        let happiness =
            weight > 0 ? weighted / weight : rules.happiness.base + 20;

        happiness += moods;
        stats.taxMult = stats.housing > 0 ? taxWeighted / stats.housing : 1;

        // Taxes (on the last step's happiness) and food, per year.
        stats.tax =
            state.population *
            economy.taxPerCitizen *
            stats.taxMult *
            (0.5 + this.stats.happiness / 100) *
            (1 + this.bonuses.tax / 100);

        const eaten = state.population * economy.foodPerCitizen;
        const income = stats.tax + stats.tourism;

        stats.rates[money] = (stats.rates[money] ?? 0) + income;
        stats.rates.food = (stats.rates.food ?? 0) - eaten;
        state.resources[money] = (state.resources[money] ?? 0) + income * year;
        state.resources.food = (state.resources.food ?? 0) - eaten * year;
        stats.starving = state.resources.food <= 0 && stats.rates.food < 0;
        state.resources.food = Math.max(0, state.resources.food);

        if (stats.starving) {
            happiness -= rules.happiness.starving;
        }

        stats.happiness = Math.max(0, Math.min(100, happiness));
        this.stats = stats;
        this.clampToCaps();
    }

    /**
     * Citizens move towards what the homes hold at their happiness (P*,
     * gdd §4.7): above it a share moves out, while starving people leave,
     * otherwise homes fill in a year or two.
     */
    private updatePopulation(dt: number): void {
        const state = this.state;
        const target = this.stats.target;
        const rules = this.content.world.population;

        if (state.population > target) {
            state.population = Math.max(
                target,
                state.population -
                    Math.max(
                        0.2,
                        (state.population - target) * rules.moveOutShare,
                    ) *
                        dt,
            );
        } else if (this.stats.starving) {
            state.population -= state.population * rules.starvingDecline * dt;
        } else {
            state.population = Math.min(
                target,
                state.population +
                    ((target - state.population) *
                        rules.growthRate *
                        Math.min(1, this.stats.happiness / 70) +
                        rules.growthFlat) *
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
                const money = goal.reward[this.content.currency] ?? 0;

                this.events.emit({
                    type: 'toast',
                    text: money
                        ? `🏆 ${goal.name} · +:amount ${this.content.currencyFace(this.state.epoch).symbol}`
                        : `🏆 ${goal.name}`,
                    tone: 'good',
                    amount: money,
                });
            }
        }
    }

    private clampToCaps(): void {
        for (const resource of this.content.resources) {
            if (this.content.isStored(resource.id)) {
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
            (event) => !event.epochs || event.epochs.includes(this.epoch.id),
        );

        state.nextEventAt =
            state.time +
            between(this.rng, rules.everyYears) * this.clock.secondsPerYear;

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
            // A share of the stores' capacity, or of the treasury for money.
            const base = Number.isFinite(this.stats.caps[id])
                ? this.stats.caps[id]
                : (state.resources[id] ?? 0);
            const delta =
                value < 1
                    ? Math.floor(base * value)
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
                until:
                    state.time + event.mood.years * this.clock.secondsPerYear,
                amount: event.mood.amount,
                reason: event.id,
            });
        }

        state.stats.events++;
        this.events.emit({
            type: 'toast',
            text: event.text,
            amount: Math.floor(amount),
            tone:
                event.lose || (event.mood && event.mood.amount < 0)
                    ? 'bad'
                    : 'good',
        });
    }

    // ———————————————————————————————————————— Tester tools

    /** Tester: fills the stores to the brim and adds money for the next Town Hall twice over. */
    testerGrant(): void {
        const next = this.townHallUpgrade()?.cost[this.content.currency] ?? 0;

        for (const resource of this.visibleResources()) {
            const cap = this.stats.caps[resource.id];

            this.state.resources[resource.id] = Number.isFinite(cap)
                ? cap
                : (this.state.resources[resource.id] ?? 0) +
                  Math.max(100_000, next * 2);
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
        this.enterNextEpoch();
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
