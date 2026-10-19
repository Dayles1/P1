/**
 * The loaded content with lookups the engine needs, plus validation of
 * the cross-file references (a level's era exists, a cost names a real
 * resource, a technology's prerequisites exist, …). It runs on every load,
 * so a broken content file stops the game with a readable list of issues.
 */

import type {
    AchievementDef,
    Amounts,
    BiomeDef,
    BlueprintDef,
    BuildingDef,
    ContentBundle,
    CurrencyFace,
    EpochDef,
    GoalCondition,
    GoalDef,
    LevelDef,
    NpcTypeDef,
    Palette,
    ResourceDef,
    SeasonDef,
    ServiceId,
    TechDef,
    WeatherDef,
} from './types';

export interface ContentIssue {
    file: string;
    path: string;
    message: string;
}

/** What the engine does specially with a building. */
export type BuildingRole = 'road' | 'center' | 'district' | 'bureau';

/**
 * The buildings with a special part, by their content ids (stable across
 * versions, gdd conventions); streets are found by `network: "road"`.
 */
export const SPECIAL_BUILDINGS = {
    center: 'town_center',
    district: 'district_hall',
    bureau: 'architect_bureau',
} as const;

export const SERVICES: ServiceId[] = [
    'water',
    'health',
    'education',
    'leisure',
    'data',
];

/** Materials: the one stock every construction price has besides money. */
export const MATERIALS = 'mat';

const ZONES = [
    'land',
    'landOrBeach',
    'mountain',
    'coast',
    'road',
    'airportPlot',
] as const;
const JOB_CLASSES = ['svc', 'food', 'raw', 'ind', 'com'] as const;
const VERBS = [
    'build',
    'charters',
    'orders',
    'rail',
    'metro',
    'routes',
    'programs',
] as const;
const CONDITIONS: GoalCondition['type'][] = [
    'population',
    'building',
    'epoch',
    'tech',
    'techs',
    'happiness',
    'coverage',
    'power',
    'heritage',
    'buildingLevel',
    'stars',
    'strips',
    'peakPopulation',
    'trafficBelow',
    'pollutionBelow',
    'noImportsYears',
    'happinessYears',
    'calendarYear',
    'neverArrears',
];

export class Content {
    readonly bundle: ContentBundle;
    readonly epochs: EpochDef[];
    readonly resources: ResourceDef[];
    readonly biomes: BiomeDef[];
    readonly seasons: SeasonDef[];
    readonly weather: WeatherDef[];
    readonly buildings: BuildingDef[];
    readonly techs: TechDef[];
    readonly blueprints: BlueprintDef[];
    /** Story goals: tasks while open, kept as done once reached. */
    readonly goals: GoalDef[];
    readonly achievements: AchievementDef[];
    readonly npcTypes: NpcTypeDef[];

    private readonly epochIndex = new Map<string, number>();
    private readonly biomeIndex = new Map<string, number>();
    private readonly buildingById = new Map<string, BuildingDef>();
    private readonly techById = new Map<string, TechDef>();
    private readonly blueprintById = new Map<string, BlueprintDef>();
    private readonly resourceById = new Map<string, ResourceDef>();
    private readonly roles = new Map<string, BuildingRole>();

    constructor(bundle: ContentBundle) {
        this.bundle = bundle;
        this.epochs = bundle.epochs.epochs;
        this.resources = bundle.resources.resources;
        this.biomes = bundle.biomes.biomes;
        this.seasons = bundle.climate.seasons;
        this.weather = bundle.climate.weather;
        this.npcTypes = bundle.npcs.types;
        this.techs = bundle.techs.techs;
        this.blueprints = bundle.blueprints.blueprints;
        this.goals = bundle.goals.story ?? [];
        this.achievements = bundle.goals.achievements ?? [];

        this.epochs.forEach((epoch, index) =>
            this.epochIndex.set(epoch.id, index),
        );
        this.biomes.forEach((biome, index) =>
            this.biomeIndex.set(biome.id, index),
        );
        this.techs.forEach((tech) => this.techById.set(tech.id, tech));
        this.blueprints.forEach((blueprint) =>
            this.blueprintById.set(blueprint.id, blueprint),
        );
        this.resources.forEach((resource) =>
            this.resourceById.set(resource.id, resource),
        );

        this.buildings = Object.values(bundle.buildings).sort(
            (a, b) =>
                this.firstEpoch(a) - this.firstEpoch(b) ||
                a.id.localeCompare(b.id),
        );
        this.buildings.forEach((building) => {
            this.buildingById.set(building.id, building);

            const role =
                building.network === 'road'
                    ? 'road'
                    : (Object.keys(SPECIAL_BUILDINGS) as BuildingRole[]).find(
                          (key) =>
                              SPECIAL_BUILDINGS[
                                  key as keyof typeof SPECIAL_BUILDINGS
                              ] === building.id,
                      );

            if (role) {
                this.roles.set(building.id, role);
            }
        });
    }

    get world() {
        return this.bundle.world;
    }

    /** The one currency's resource id ('money'). */
    get currency(): string {
        return this.bundle.world.economy.currency;
    }

    /** How the money looks in an era (index). */
    currencyFace(epochIndex: number): CurrencyFace {
        return this.epoch(epochIndex).currency;
    }

    epochOrder(id: string): number {
        return this.epochIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
    }

    epoch(index: number): EpochDef {
        return this.epochs[
            Math.max(0, Math.min(this.epochs.length - 1, index))
        ];
    }

    epochById(id: string): EpochDef {
        return this.epoch(this.epochIndex.get(id) ?? 0);
    }

    biomeIndexOf(id: string): number {
        return this.biomeIndex.get(id) ?? 0;
    }

    building(id: string): BuildingDef {
        const def = this.buildingById.get(id);

        if (!def) {
            throw new Error(`Unknown building "${id}"`);
        }

        return def;
    }

    hasBuilding(id: string): boolean {
        return this.buildingById.has(id);
    }

    /** What the engine does specially with a building, if anything. */
    roleOf(def: BuildingDef): BuildingRole | null {
        return this.roles.get(def.id) ?? null;
    }

    /** The building with a special role (the town centre, streets, …). */
    byRole(role: BuildingRole): BuildingDef | undefined {
        return this.buildings.find((def) => this.roleOf(def) === role);
    }

    level(def: BuildingDef, level: number): LevelDef {
        return def.levels[
            Math.max(0, Math.min(def.levels.length - 1, level - 1))
        ];
    }

    /** The era a building first appears in (its first level's). */
    firstEpoch(def: BuildingDef): number {
        return this.epochOrder(def.levels[0]?.epoch ?? '');
    }

    /** The architecture a level is drawn with: its own era's palette. */
    levelPalette(level: LevelDef): Palette {
        return this.epochById(level.epoch).palette;
    }

    tech(id: string): TechDef | undefined {
        return this.techById.get(id);
    }

    blueprint(id: string): BlueprintDef | undefined {
        return this.blueprintById.get(id);
    }

    resource(id: string): ResourceDef | undefined {
        return this.resourceById.get(id);
    }

    /** Resources kept in the stores (everything but the currency). */
    isStored(id: string): boolean {
        const resource = this.resourceById.get(id);

        return resource !== undefined && resource.kind !== 'currency';
    }

    emptyAmounts(): Amounts {
        return Object.fromEntries(
            this.resources.map((resource) => [resource.id, 0]),
        );
    }

    npcTypesFor(epochIndex: number, role: NpcTypeDef['role']): NpcTypeDef[] {
        const epochId = this.epoch(epochIndex).id;

        return this.npcTypes.filter(
            (type) => type.role === role && type.epochs.includes(epochId),
        );
    }
}

const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

/**
 * The fixed map's land (gdd §5): portals and deposit spots where their
 * band is (ore and coal 2×2 at the mountain foot, oil at the waterline),
 * not on top of each other; the airport plot on the beach; the bay, capes
 * and sunny slope inside the map; strips that fit the map, priced for
 * every purchase.
 */
function checkLand(
    world: ContentBundle['world'],
    buildings: Set<string>,
    add: (file: string, path: string, message: string) => void,
): void {
    const map = world.map;

    if (!map?.start) {
        // Reported with the map's size and start columns.
        return;
    }

    const width = map.width;
    const waterline = map.landRows + map.beachRows - 1;
    const column = (x: unknown) =>
        Number.isInteger(x) && (x as number) >= 0 && (x as number) < width;
    const span = (s: { minX: number; maxX: number } | undefined) =>
        column(s?.minX) && column(s?.maxX) && s!.minX <= s!.maxX;
    const taken = new Set<string>();

    for (const [index, portal] of (map.portals ?? []).entries()) {
        if (!column(portal)) {
            add('world', `map.portals[${index}]`, 'Портал — столбец карты');
        }

        taken.add(`${portal},0`);
    }

    for (const [index, spot] of (map.deposits ?? []).entries()) {
        const row = spot?.kind === 'oil' ? waterline : 0;
        const fits =
            ['ore', 'coal', 'oil'].includes(spot?.kind) &&
            column(spot.x) &&
            column(spot.x + spot.w - 1) &&
            spot.y === row &&
            Number.isInteger(spot.w) &&
            Number.isInteger(spot.h) &&
            spot.w >= 1 &&
            spot.h >= 1 &&
            (spot.kind === 'oil' ? spot.h === 1 : spot.h <= map.landRows);
        let free = true;

        for (let y = spot?.y ?? 0; fits && y < spot.y + spot.h; y++) {
            for (let x = spot.x; x < spot.x + spot.w; x++) {
                free &&= !taken.has(`${x},${y}`);
                taken.add(`${x},${y}`);
            }
        }

        if (!fits || !free) {
            add(
                'world',
                `map.deposits[${index}]`,
                'Руда и уголь — у подножия гор (y = 0), нефть — 1 клетка на линии воды; месторождения и порталы не перекрываются',
            );
        }
    }

    const plot = map.airportPlot;

    if (!(
        column(plot?.x) &&
        column(plot.x + plot.w - 1) &&
        plot.y >= map.landRows &&
        plot.y + plot.h - 1 < waterline &&
        Array.isArray(plot.allow) &&
        plot.allow.every((id) => buildings.has(id))
    )) {
        add(
            'world',
            'map.airportPlot',
            'Участок аэропорта — на пляже, не у самой воды; allow — id зданий',
        );
    }

    const features = map.features;

    if (
        !(map.richMult >= 1) ||
        !span(features?.bay) ||
        !(features.bay.trade > 0 && features.bay.visitors > 0) ||
        !(features.bay.fishery > 0 && features.bay.fisheryMax >= 0) ||
        !Array.isArray(features.cape) ||
        !features.cape.every(span) ||
        !(features.capeAttraction > 0) ||
        !span(features.sunny) ||
        !(features.sunny.solar > 0)
    ) {
        add(
            'world',
            'map.features',
            'Нужны richMult ≥ 1, бухта, мысы и солнечный склон внутри карты с множителями больше 0',
        );
    }

    const land = world.land;

    if (
        !(Number.isInteger(land?.stripWidth) && land.stripWidth >= 1) ||
        !(Number.isInteger(land.perSide) && land.perSide >= 0) ||
        map.start.minX - land.perSide * land.stripWidth < 0 ||
        map.start.maxX + land.perSide * land.stripWidth >= width ||
        !Array.isArray(land.price) ||
        land.price.length !== land.perSide * 2 ||
        !land.price.every(
            (price, i) =>
                isNumber(price) &&
                price > 0 &&
                price >= (land.price[i - 1] ?? 0),
        )
    ) {
        add(
            'world',
            'land',
            'Полосы помещаются на карте; price — по цене на каждую из perSide × 2 покупок, не дешевле предыдущей',
        );
    }
}

/**
 * Every problem in a content bundle; an empty list means the game can run
 * on it.
 */
export function validateContent(
    bundle: Partial<ContentBundle>,
): ContentIssue[] {
    const issues: ContentIssue[] = [];
    const add = (file: string, path: string, message: string) =>
        issues.push({ file, path, message });

    for (const file of [
        'world',
        'resources',
        'biomes',
        'climate',
        'epochs',
        'techs',
        'blueprints',
        'goals',
        'npcs',
        'sounds',
        'buildings',
    ] as const) {
        if (!bundle[file] || typeof bundle[file] !== 'object') {
            add(file, '', 'Файл отсутствует или пустой');
        }
    }

    if (issues.length) {
        return issues;
    }

    const content = bundle as ContentBundle;
    const resourceList = content.resources.resources ?? [];
    const resources = new Set(resourceList.map((r) => r.id));
    const epochList = (content.epochs.epochs ?? []).map((e) => e.id);
    const epochs = new Set(epochList);
    const order = (id: string) => epochList.indexOf(id);
    const biomes = new Set((content.biomes.biomes ?? []).map((b) => b.id));
    const weather = new Set((content.climate.weather ?? []).map((w) => w.id));
    const sounds = new Set(Object.keys(content.sounds.presets ?? {}));
    const buildings = new Set(Object.keys(content.buildings));
    const techList = content.techs.techs ?? [];
    const techs = new Map(techList.map((t) => [t.id, t]));
    const currency = content.world.economy?.currency;
    const townHall = content.buildings[SPECIAL_BUILDINGS.center];

    const checkAmounts = (
        file: string,
        path: string,
        amounts: unknown,
        allowed?: string[],
    ) => {
        if (amounts === undefined || amounts === null) {
            return;
        }

        if (typeof amounts !== 'object') {
            add(file, path, 'Должно быть объектом { ресурс: число }');

            return;
        }

        for (const [id, value] of Object.entries(amounts as Amounts)) {
            if (!resources.has(id)) {
                add(file, `${path}.${id}`, `Нет такого ресурса «${id}»`);
            } else if (allowed && !allowed.includes(id)) {
                add(
                    file,
                    `${path}.${id}`,
                    `Здесь можно только: ${allowed.join(', ')}`,
                );
            }

            if (!isNumber(value) || value < 0) {
                add(file, `${path}.${id}`, 'Нужно неотрицательное число');
            }
        }
    };
    const checkEpoch = (file: string, path: string, id: unknown) => {
        if (!epochs.has(id as string)) {
            add(file, path, `Нет эпохи «${String(id)}»`);
        }
    };
    const checkTech = (file: string, path: string, id: unknown) => {
        if (!techs.has(id as string)) {
            add(file, path, `Нет открытия «${String(id)}»`);
        }
    };
    const checkBuilding = (file: string, path: string, id: unknown) => {
        if (!buildings.has(id as string)) {
            add(file, path, `Нет здания «${String(id)}»`);
        }
    };
    const checkCondition = (
        file: string,
        path: string,
        condition: GoalCondition | undefined,
    ) => {
        if (!condition || !CONDITIONS.includes(condition.type)) {
            add(
                file,
                `${path}.type`,
                `Неизвестное условие «${String(condition?.type)}»`,
            );

            return;
        }

        if (condition.type === 'building') {
            for (const id of ([] as string[]).concat(condition.building)) {
                checkBuilding(file, `${path}.building`, id);
            }
        } else if (condition.type === 'buildingLevel') {
            checkBuilding(file, `${path}.building`, condition.building);
        } else if (
            condition.type === 'epoch' ||
            condition.type === 'noImportsYears'
        ) {
            checkEpoch(file, `${path}.epoch`, condition.epoch);
        } else if (condition.type === 'tech') {
            checkTech(file, `${path}.tech`, condition.tech);
        } else if (
            condition.type === 'coverage' &&
            !SERVICES.includes(condition.service)
        ) {
            add(file, `${path}.service`, `Нет услуги «${condition.service}»`);
        }
    };

    // world
    const world = content.world;
    const map = world.map;
    const rows =
        (map?.landRows ?? 0) + (map?.beachRows ?? 0) + (map?.seaRows ?? 0);

    if (
        !(map?.width >= 16 && map.width <= 256 && rows >= 16 && rows <= 256) ||
        !(map.landRows >= 1 && map.beachRows >= 0 && map.seaRows >= 0)
    ) {
        add(
            'world',
            'map',
            'Размер карты — от 16 до 256 клеток по каждой стороне, суша — хотя бы один ряд',
        );
    }

    for (const band of ['land', 'beach', 'sea'] as const) {
        if (!biomes.has(map?.biomes?.[band])) {
            add(
                'world',
                `map.biomes.${band}`,
                `Нет биома «${String(map?.biomes?.[band])}»`,
            );
        }
    }

    if (!(
        map?.start?.minX >= 0 &&
        map.start.minX <= map.start.maxX &&
        map.start.maxX < map.width
    )) {
        add(
            'world',
            'map.start',
            'Открытые столбцы — внутри карты, и minX не больше maxX',
        );
    }

    checkLand(world, buildings, add);

    if (!(world.time?.secondsPerDay >= 10)) {
        add('world', 'time.secondsPerDay', 'Сутки — не короче 10 секунд');
    }

    if (!(world.time?.secondsPerYear >= 1)) {
        add('world', 'time.secondsPerYear', 'Год — не короче секунды');
    }

    checkEpoch('world', 'start.epoch', world.start?.epoch);
    checkAmounts('world', 'start.resources', world.start?.resources);

    for (const [index, start] of (world.start?.buildings ?? []).entries()) {
        checkBuilding('world', `start.buildings[${index}]`, start.type);
    }

    const economy = world.economy;

    if (resourceList.find((r) => r.id === currency)?.kind !== 'currency') {
        add(
            'world',
            'economy.currency',
            `Валюта «${String(currency)}» должна быть ресурсом вида currency`,
        );
    }

    if (
        !Array.isArray(economy?.taxMultByLevelEra) ||
        economy.taxMultByLevelEra.length !== epochList.length ||
        !economy.taxMultByLevelEra.every((v) => isNumber(v) && v > 0)
    ) {
        add(
            'world',
            'economy.taxMultByLevelEra',
            'Нужен положительный множитель налога для каждой эпохи',
        );
    }

    for (const key of [
        'taxPerCitizen',
        'workforceShare',
        'foodPerCitizen',
        'storageBase',
    ] as const) {
        if (!isNumber(economy?.[key]) || economy[key] < 0) {
            add('world', `economy.${key}`, 'Нужно неотрицательное число');
        }
    }

    for (const key of [
        'tradeIn',
        'upgradeFloor',
        'refundShare',
        'moveShare',
    ] as const) {
        if (!isNumber(economy?.[key]) || economy[key] < 0 || economy[key] > 1) {
            add('world', `economy.${key}`, 'Нужна доля от 0 до 1');
        }
    }

    for (const [key, price] of Object.entries(economy?.prices ?? {})) {
        if (!isNumber(price) || price < 0) {
            add(
                'world',
                `economy.prices.${key}`,
                'Нужно неотрицательное число',
            );
        }
    }

    if (!isNumber(economy?.prices?.matImport)) {
        add(
            'world',
            'economy.prices.matImport',
            'Нужна цена докупки стройматериалов',
        );
    }

    for (const key of ['exportAbove', 'unemploymentTaxLoss'] as const) {
        if (!isNumber(economy?.[key]) || economy[key] < 0 || economy[key] > 1) {
            add('world', `economy.${key}`, 'Нужна доля от 0 до 1');
        }
    }

    if (
        !isNumber(economy?.powerShortfall?.base) ||
        !isNumber(economy?.powerShortfall?.share) ||
        economy.powerShortfall.base + economy.powerShortfall.share !== 1
    ) {
        add(
            'world',
            'economy.powerShortfall',
            'base + share должны давать 1 (полная работа при полной энергии)',
        );
    }

    const tourism = economy?.tourism;

    if (
        !isNumber(tourism?.perPoint) ||
        !Array.isArray(tourism?.eraMult) ||
        tourism.eraMult.length !== epochList.length ||
        !tourism.eraMult.every((v) => isNumber(v) && v > 0) ||
        !(tourism.heritageMult >= 1) ||
        !(tourism.heritageEraGap >= 1) ||
        !(tourism.heritageRampYears >= 0) ||
        !(tourism.beachManorMult >= 1)
    ) {
        add(
            'world',
            'economy.tourism',
            'Нужны perPoint, eraMult для каждой эпохи и множители наследия',
        );
    }

    const policies = economy?.policies;
    const taxOptions = policies?.tax?.options;

    checkEpoch('world', 'economy.policies.tax.epoch', policies?.tax?.epoch);
    checkEpoch('world', 'economy.policies.dense.epoch', policies?.dense?.epoch);

    if (
        !(policies?.lockYears >= 0) ||
        !(['low', 'normal', 'high'] as const).every(
            (id) =>
                isNumber(taxOptions?.[id]?.tax) &&
                taxOptions[id].tax > 0 &&
                isNumber(taxOptions[id].happiness) &&
                Boolean(taxOptions[id].name),
        ) ||
        !isNumber(policies?.dense?.housing) ||
        !isNumber(policies.dense.happiness) ||
        !isNumber(policies.dense.trips)
    ) {
        add(
            'world',
            'economy.policies',
            'Нужны lockYears, налоги low/normal/high (tax, happiness, name) и dense',
        );
    }

    const treasury = economy?.treasury;

    if (
        !(treasury?.mothballPerYear >= 0) ||
        !(treasury?.loan?.maxYearsOfGross >= 0) ||
        !(treasury.loan.ratePerYear >= 0) ||
        !(
            treasury.loan.repayShareOfNet > 0 &&
            treasury.loan.repayShareOfNet <= 1
        ) ||
        !(treasury?.chest?.maxYearsOfNet >= 0) ||
        !(treasury.chest.fillRealHours > 0) ||
        !(treasury.chest.cooldownYears >= 0)
    ) {
        add(
            'world',
            'economy.treasury',
            'Нужны mothballPerYear, loan (maxYearsOfGross, ratePerYear, repayShareOfNet) и chest',
        );
    }

    const chronicle = world.chronicle;
    const score = chronicle?.score;

    if (
        !(chronicle?.lead?.building > 0 && chronicle.lead.building <= 1) ||
        !(chronicle.lead.progress > 0 && chronicle.lead.progress <= 1) ||
        !(chronicle.lead.fallingYears >= 1) ||
        !(chronicle?.golden?.perStar >= 0) ||
        !(chronicle.golden.years > 0) ||
        !(
            chronicle.golden.rampYears > 0 &&
            chronicle.golden.rampYears * 2 <= chronicle.golden.years
        ) ||
        !isNumber(chronicle.golden.happiness) ||
        !(chronicle?.spirit?.perYear >= 0) ||
        !(chronicle.spirit.cap >= 0 && chronicle.spirit.cap < 1) ||
        !(chronicle?.transitionYears > 0) ||
        !Array.isArray(score?.starPoints) ||
        score.starPoints.length !== 4 ||
        !score.starPoints.every(isNumber) ||
        ![
            score.eraBase,
            score.cityPerSqrtPeak,
            score.happinessBase,
            score.happinessShare,
            score.happinessYears,
            score.perStrip,
            score.perAchievement,
        ].every((value) => isNumber(value) && value >= 0)
    ) {
        add(
            'world',
            'chronicle',
            'Нужны lead, golden (rampYears × 2 ≤ years), spirit (cap < 1), transitionYears и score',
        );
    }

    const needKinds = new Set<string>([
        ...SERVICES,
        'happiness',
        'aura',
        'power',
        'transit',
    ]);

    for (const [index, need] of (world.population?.needs ?? []).entries()) {
        if (!needKinds.has(need?.need) || !need.label) {
            add(
                'world',
                `population.needs[${index}]`,
                'Нужда — услуга, happiness, aura, power или transit, с подписью',
            );
        }
    }

    if (!(world.districts?.radius >= 1)) {
        add('world', 'districts.radius', 'Радиус округа — от 1 клетки');
    }

    if (
        !(world.events?.firstYear >= 0) ||
        !(
            world.events?.everyYears?.[0] > 0 &&
            world.events.everyYears[1] >= world.events.everyYears[0]
        )
    ) {
        add(
            'world',
            'events',
            'firstYear — от 0, everyYears — [от, до] больше нуля',
        );
    }

    for (const [index, event] of (world.events?.list ?? []).entries()) {
        checkAmounts('world', `events.list[${index}].gain`, event.gain);
        checkAmounts('world', `events.list[${index}].lose`, event.lose);
        (event.epochs ?? []).forEach((e) =>
            checkEpoch('world', `events.list[${index}].epochs`, e),
        );
    }

    // resources
    for (const [index, resource] of resourceList.entries()) {
        checkEpoch('resources', `resources[${index}].epoch`, resource.epoch);

        if (!['currency', 'stock', 'flow'].includes(resource.kind)) {
            add(
                'resources',
                `resources[${index}].kind`,
                'Вид ресурса — currency, stock или flow',
            );
        }

        for (const era of Object.keys(resource.faces ?? {})) {
            checkEpoch('resources', `resources[${index}].faces`, era);
        }
    }

    if (resourceList.filter((r) => r.kind === 'currency').length !== 1) {
        add('resources', 'resources', 'Валюта должна быть ровно одна');
    }

    if (!resources.has(MATERIALS)) {
        add('resources', 'resources', `Нужен ресурс «${MATERIALS}»`);
    }

    // biomes
    if (!content.biomes.biomes?.length) {
        add('biomes', 'biomes', 'Нужен хотя бы один биом');
    }

    // climate
    if (!content.climate.seasons?.length) {
        add('climate', 'seasons', 'Нужен хотя бы один сезон');
    }

    for (const [index, season] of (content.climate.seasons ?? []).entries()) {
        Object.keys(season.weather ?? {})
            .filter((id) => !weather.has(id))
            .forEach((id) =>
                add(
                    'climate',
                    `seasons[${index}].weather.${id}`,
                    `Нет погоды «${id}»`,
                ),
            );
    }

    const frames = content.climate.dayNight?.keyframes ?? [];

    if (frames.length < 2 || frames[0].at !== 0 || frames.at(-1)!.at !== 1) {
        add(
            'climate',
            'dayNight.keyframes',
            'Ключевые кадры суток должны начинаться с at: 0 и заканчиваться at: 1',
        );
    }

    // epochs
    let previousTownHall = 0;

    for (const [index, epoch] of (content.epochs.epochs ?? []).entries()) {
        const path = `epochs[${index}]`;

        if (index > 0 && epoch.year <= content.epochs.epochs[index - 1].year) {
            add(
                'epochs',
                `${path}.year`,
                'Годы эпох должны идти по возрастанию',
            );
        }

        for (const key of [
            'name',
            'short',
            'symbol',
            'icon',
            'flavor',
        ] as const) {
            if (!epoch.currency?.[key]) {
                add(
                    'epochs',
                    `${path}.currency.${key}`,
                    'Нужно лицо валюты: name, short, symbol, icon, flavor',
                );
            }
        }

        if (!VERBS.includes(epoch.verb)) {
            add(
                'epochs',
                `${path}.verb`,
                `Нет такого действия «${epoch.verb}»`,
            );
        }

        if (!/^#[0-9a-fA-F]{6}$/.test(epoch.accent ?? '')) {
            add('epochs', `${path}.accent`, 'Цвет — в виде #rrggbb');
        }

        if (
            !/^#[0-9a-fA-F]{6}$/.test(epoch.atmosphere?.tint ?? '') ||
            !(
                epoch.atmosphere.strength >= 0 &&
                epoch.atmosphere.strength <= 0.3
            ) ||
            !(epoch.atmosphere.fog > 0)
        ) {
            add(
                'epochs',
                `${path}.atmosphere`,
                'Нужны tint (#rrggbb), strength от 0 до 0,3 и fog больше 0',
            );
        }

        if (!content.sounds.ambience?.[epoch.ambience]) {
            add(
                'epochs',
                `${path}.ambience`,
                `Нет фоновых звуков «${epoch.ambience}» в sounds.json`,
            );
        }

        const entry = epoch.entry;

        if (index === 0) {
            if (entry) {
                add('epochs', `${path}.entry`, 'В первую эпоху не входят');
            }

            continue;
        }

        if (!entry) {
            add('epochs', `${path}.entry`, 'Нужно условие входа в эпоху');
            continue;
        }

        const level = townHall?.levels[entry.townHallLevel - 1];

        if (!level || entry.townHallLevel <= previousTownHall) {
            add(
                'epochs',
                `${path}.entry.townHallLevel`,
                'Нужен следующий уровень ратуши',
            );
        } else if (level.epoch !== epoch.id) {
            add(
                'epochs',
                `${path}.entry.townHallLevel`,
                `Уровень ратуши ${entry.townHallLevel} — из другой эпохи`,
            );
        }

        previousTownHall = entry.townHallLevel ?? previousTownHall;

        const previousTechs = techList.filter(
            (tech) => tech.epoch === epochList[index - 1],
        ).length;

        if (
            !isNumber(entry.population) ||
            entry.population < 0 ||
            !isNumber(entry.discoveries) ||
            entry.discoveries < 0 ||
            entry.discoveries > previousTechs
        ) {
            add(
                'epochs',
                `${path}.entry`,
                'Население — от 0, открытий — не больше, чем в прошлой эпохе',
            );
        }

        const [two, three] = entry.stars ?? [];

        if (!(
            isNumber(two) &&
            isNumber(three) &&
            three <= two &&
            two <= epoch.year
        )) {
            add(
                'epochs',
                `${path}.entry.stars`,
                'Звёзды — [год для ★★, год для ★★★], не позже года эпохи',
            );
        }

        for (const [itemIndex, item] of (entry.items ?? []).entries()) {
            const itemPath = `${path}.entry.items[${itemIndex}]`;

            checkBuilding('epochs', `${itemPath}.type`, item.type);

            if (
                buildings.has(item.type) &&
                !content.buildings[item.type].levels[item.level - 1]
            ) {
                add('epochs', `${itemPath}.level`, 'Нет такого уровня');
            }

            if (!(item.count >= 1) || !item.label) {
                add('epochs', itemPath, 'Нужны count от 1 и label');
            }
        }
    }

    // techs
    for (const [index, tech] of techList.entries()) {
        const path = `techs[${index}]`;

        checkEpoch('techs', `${path}.epoch`, tech.epoch);
        checkAmounts('techs', `${path}.cost`, tech.cost, [currency]);

        for (const required of tech.requires ?? []) {
            checkTech('techs', `${path}.requires`, required);

            if (
                techs.has(required) &&
                order(techs.get(required)!.epoch) > order(tech.epoch)
            ) {
                add(
                    'techs',
                    `${path}.requires`,
                    `«${required}» — из более поздней эпохи`,
                );
            }
        }

        for (const id of Object.keys(tech.bonus?.produces ?? {})) {
            if (id !== '*' && !resources.has(id)) {
                add(
                    'techs',
                    `${path}.bonus.produces.${id}`,
                    `Нет такого ресурса «${id}»`,
                );
            }
        }
    }

    const visiting = new Set<string>();
    const done = new Set<string>();
    const cyclic = (id: string): boolean => {
        if (done.has(id)) {
            return false;
        }

        if (visiting.has(id)) {
            return true;
        }

        visiting.add(id);

        const found = (techs.get(id)?.requires ?? []).some(cyclic);

        visiting.delete(id);
        done.add(id);

        return found;
    };

    for (const tech of techList) {
        if (cyclic(tech.id)) {
            add('techs', tech.id, 'Открытия требуют друг друга по кругу');
            break;
        }
    }

    // blueprints
    for (const [index, blueprint] of (
        content.blueprints.blueprints ?? []
    ).entries()) {
        const path = `blueprints[${index}]`;

        checkEpoch('blueprints', `${path}.epoch`, blueprint.epoch);
        checkAmounts('blueprints', `${path}.cost`, blueprint.cost, [currency]);
        (blueprint.buildings ?? []).forEach((b) =>
            checkBuilding('blueprints', `${path}.buildings`, b),
        );
    }

    // goals
    const goalIds = new Set<string>();
    const checkId = (path: string, id: string) => {
        if (goalIds.has(id)) {
            add('goals', path, `id «${id}» уже занят`);
        }

        goalIds.add(id);
    };

    for (const [index, goal] of (content.goals.story ?? []).entries()) {
        const path = `story[${index}]`;

        checkId(`${path}.id`, goal.id);
        checkEpoch('goals', `${path}.epoch`, goal.epoch);
        checkAmounts('goals', `${path}.reward`, goal.reward, [currency]);
        checkCondition('goals', `${path}.condition`, goal.condition);
    }

    for (const [index, side] of (content.goals.sideTemplates ?? []).entries()) {
        checkCondition(
            'goals',
            `sideTemplates[${index}].condition`,
            side.condition,
        );
    }

    for (const [index, achievement] of (
        content.goals.achievements ?? []
    ).entries()) {
        checkId(`achievements[${index}].id`, achievement.id);
        checkCondition(
            'goals',
            `achievements[${index}].condition`,
            achievement.condition,
        );
    }

    // npcs
    for (const [index, type] of (content.npcs.types ?? []).entries()) {
        type.epochs.forEach((e) =>
            checkEpoch('npcs', `types[${index}].epochs`, e),
        );

        if (!type.body?.length) {
            add('npcs', `types[${index}].body`, 'Нужен хотя бы один цвет');
        }
    }

    // sounds
    for (const [id, preset] of Object.entries(content.sounds.presets ?? {})) {
        if (!preset.file && !(preset.synth?.duration > 0)) {
            add(
                'sounds',
                `presets.${id}`,
                'Нужен file или synth с duration > 0',
            );
        }
    }

    for (const [id, set] of Object.entries(content.sounds.ambience ?? {})) {
        [...set.day, ...set.night]
            .filter((s) => !sounds.has(s))
            .forEach((s) =>
                add('sounds', `ambience.${id}`, `Нет звука «${s}»`),
            );
    }

    // buildings
    let roads = 0;

    for (const [key, building] of Object.entries(content.buildings)) {
        const file = `buildings/${key}`;

        if (building.id !== key) {
            add(
                file,
                'id',
                `id «${building.id}» должен совпадать с именем файла «${key}»`,
            );
        }

        if (!(
            building.size?.w >= 1 &&
            building.size?.w <= 12 &&
            building.size?.h >= 1 &&
            building.size?.h <= 4
        )) {
            add(file, 'size', 'Размер — от 1×1 до 12×4');
        }

        if (![null, 'road', 'rail'].includes(building.network)) {
            add(file, 'network', 'Сеть — null, road или rail');
        }

        roads += building.network === 'road' ? 1 : 0;

        if (
            building.network
                ? building.jobClass !== null
                : !JOB_CLASSES.includes(building.jobClass!)
        ) {
            add(
                file,
                'jobClass',
                'Класс работ — svc, food, raw, ind или com (у сетей — null)',
            );
        }

        if (!ZONES.includes(building.placement?.zone)) {
            add(
                file,
                'placement.zone',
                `Нет зоны «${building.placement?.zone}»`,
            );
        }

        if (
            building.placement?.deposit !== undefined &&
            (!['ore', 'coal', 'oil'].includes(building.placement.deposit) ||
                !['mountain', 'coast'].includes(building.placement.zone))
        ) {
            add(
                file,
                'placement.deposit',
                'Залежь — ore, coal или oil, у гор или на берегу',
            );
        }

        if (!(building.taxMult > 0)) {
            add(file, 'taxMult', 'Множитель налога — больше нуля');
        }

        for (const [slot, sound] of Object.entries(building.sounds ?? {})) {
            if (sound && !sounds.has(sound)) {
                add(
                    file,
                    `sounds.${slot}`,
                    `Нет звука «${sound}» в sounds.json`,
                );
            }
        }

        if (!building.levels?.length) {
            add(file, 'levels', 'Нужен хотя бы один уровень');
            continue;
        }

        let previousEpoch = -1;

        building.levels.forEach((level, index) => {
            const path = `levels[${index}]`;

            if (level.level !== index + 1) {
                add(
                    file,
                    `${path}.level`,
                    `Уровни нумеруются по порядку: ожидался ${index + 1}`,
                );
            }

            checkEpoch(file, `${path}.epoch`, level.epoch);

            if (order(level.epoch) < previousEpoch) {
                add(
                    file,
                    `${path}.epoch`,
                    'Эпохи уровней не должны идти назад',
                );
            }

            previousEpoch = Math.max(previousEpoch, order(level.epoch));

            if (level.tech) {
                checkTech(file, `${path}.tech`, level.tech);

                if (
                    techs.has(level.tech) &&
                    order(techs.get(level.tech)!.epoch) > order(level.epoch)
                ) {
                    add(
                        file,
                        `${path}.tech`,
                        `Открытие «${level.tech}» из более поздней эпохи, чем уровень`,
                    );
                }
            }

            checkAmounts(file, `${path}.cost`, level.cost, [
                currency,
                MATERIALS,
            ]);

            if (!isNumber(level.cost?.[currency])) {
                add(file, `${path}.cost.${currency}`, 'Нужна цена в деньгах');
            }

            if (!isNumber(level.upkeep) || level.upkeep < 0) {
                add(
                    file,
                    `${path}.upkeep`,
                    'Содержание — неотрицательное число в год',
                );
            }

            if (!isNumber(level.buildTime) || level.buildTime < 0) {
                add(file, `${path}.buildTime`, 'Нужно неотрицательное число');
            }

            if (
                !Number.isInteger(level.tier) ||
                level.tier < 0 ||
                level.tier > 10
            ) {
                add(file, `${path}.tier`, 'Ступень потребностей — от 0 до 10');
            }

            if (
                level.requires?.townHallLevel !== undefined &&
                !townHall?.levels[level.requires.townHallLevel - 1]
            ) {
                add(
                    file,
                    `${path}.requires.townHallLevel`,
                    'Нет такого уровня ратуши',
                );
            }

            const effects = level.effects;

            for (const kind of ['produces', 'consumes'] as const) {
                checkAmounts(file, `${path}.effects.${kind}`, effects?.[kind]);

                if (effects?.[kind]?.[currency] !== undefined) {
                    add(
                        file,
                        `${path}.effects.${kind}.${currency}`,
                        'Деньги не производятся зданиями',
                    );
                }
            }

            if (
                effects?.coverage &&
                !SERVICES.includes(effects.coverage.service)
            ) {
                add(
                    file,
                    `${path}.effects.coverage.service`,
                    `Нет услуги «${effects.coverage.service}»`,
                );
            }

            for (const target of effects?.boost?.targets ?? []) {
                checkBuilding(file, `${path}.effects.boost.targets`, target);
            }

            if (!Array.isArray(level.model?.parts)) {
                add(file, `${path}.model.parts`, 'Нужен массив деталей модели');
            }
        });
    }

    for (const [role, id] of Object.entries(SPECIAL_BUILDINGS)) {
        if (!buildings.has(id)) {
            add('buildings', '', `Нужно здание «${id}» (${role})`);
        }
    }

    if (townHall && (!townHall.unique || !townHall.hidden)) {
        add(
            `buildings/${SPECIAL_BUILDINGS.center}`,
            'unique',
            'Ратуша — одна (unique) и не в меню (hidden)',
        );
    }

    if (!roads) {
        add('buildings', '', 'Нужно здание с network: "road" (улица)');
    }

    return issues;
}
