/**
 * The loaded content with lookups the engine needs, plus validation of
 * the cross-file references (a level's era exists, a cost names a real
 * resource, a technology's prerequisites exist, …). The Workshop runs the
 * same validation on every edit.
 */

import type {
    Amounts,
    BiomeDef,
    BlueprintDef,
    BuildingDef,
    ContentBundle,
    EpochDef,
    GoalDef,
    LevelDef,
    NpcTypeDef,
    Palette,
    ResourceDef,
    SeasonDef,
    TechDef,
    WeatherDef,
} from './types';

export interface ContentIssue {
    file: string;
    path: string;
    message: string;
}

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
    readonly goals: GoalDef[];
    readonly npcTypes: NpcTypeDef[];

    private readonly epochIndex = new Map<string, number>();
    private readonly biomeIndex = new Map<string, number>();
    private readonly buildingById = new Map<string, BuildingDef>();
    private readonly techById = new Map<string, TechDef>();
    private readonly blueprintById = new Map<string, BlueprintDef>();
    private readonly resourceById = new Map<string, ResourceDef>();

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
        this.goals = bundle.goals.goals;

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
        this.buildings.forEach((building) =>
            this.buildingById.set(building.id, building),
        );
    }

    get world() {
        return this.bundle.world;
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
        return this.biomeIndex.get(id) ?? this.biomes.length - 1;
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

    /** The building with a special role (the town centre, roads, …). */
    byRole(role: NonNullable<BuildingDef['role']>): BuildingDef | undefined {
        return this.buildings.find((def) => def.role === role);
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
    const resources = new Set(
        (content.resources.resources ?? []).map((r) => r.id),
    );
    const epochList = (content.epochs.epochs ?? []).map((e) => e.id);
    const epochs = new Set(epochList);
    const order = (id: string) => epochList.indexOf(id);
    const biomes = new Set((content.biomes.biomes ?? []).map((b) => b.id));
    const seasons = new Set((content.climate.seasons ?? []).map((s) => s.id));
    const weather = new Set((content.climate.weather ?? []).map((w) => w.id));
    const sounds = new Set(Object.keys(content.sounds.presets ?? {}));
    const buildings = new Set(Object.keys(content.buildings));
    const techList = content.techs.techs ?? [];
    const techs = new Map(techList.map((t) => [t.id, t]));

    const checkAmounts = (file: string, path: string, amounts: unknown) => {
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
            }

            if (typeof value !== 'number' || value < 0) {
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
            add(file, path, `Нет технологии «${String(id)}»`);
        }
    };
    const checkBuilding = (file: string, path: string, id: unknown) => {
        if (!buildings.has(id as string)) {
            add(file, path, `Нет здания «${String(id)}»`);
        }
    };

    // world
    const world = content.world;

    if (!(
        world.map?.width >= 16 &&
        world.map?.width <= 256 &&
        world.map?.height >= 16 &&
        world.map?.height <= 256
    )) {
        add(
            'world',
            'map',
            'Размер карты — от 16 до 256 клеток по каждой стороне',
        );
    }

    if (!(world.time?.secondsPerDay >= 10)) {
        add('world', 'time.secondsPerDay', 'Сутки — не короче 10 секунд');
    }

    checkEpoch('world', 'start.epoch', world.start?.epoch);
    checkAmounts('world', 'start.resources', world.start?.resources);

    for (const [index, start] of (world.start?.buildings ?? []).entries()) {
        checkBuilding('world', `start.buildings[${index}]`, start.type);
    }

    if (!(world.districts?.radius >= 1)) {
        add('world', 'districts.radius', 'Радиус округа — от 1 клетки');
    }

    for (const [index, policy] of (world.districts?.policies ?? []).entries()) {
        for (const id of Object.keys(policy.effects?.produces ?? {})) {
            if (id !== '*' && !resources.has(id)) {
                add(
                    'world',
                    `districts.policies[${index}].effects.produces.${id}`,
                    `Нет такого ресурса «${id}»`,
                );
            }
        }
    }

    for (const [index, event] of (world.events?.list ?? []).entries()) {
        checkAmounts('world', `events.list[${index}].gain`, event.gain);
        checkAmounts('world', `events.list[${index}].lose`, event.lose);
        (event.seasons ?? [])
            .filter((s) => !seasons.has(s))
            .forEach((s) =>
                add(
                    'world',
                    `events.list[${index}].seasons`,
                    `Нет сезона «${s}»`,
                ),
            );
        (event.epochs ?? []).forEach((e) =>
            checkEpoch('world', `events.list[${index}].epochs`, e),
        );
    }

    // resources
    for (const [index, resource] of (
        content.resources.resources ?? []
    ).entries()) {
        checkEpoch('resources', `resources[${index}].epoch`, resource.epoch);
    }

    // biomes
    if (!content.biomes.biomes?.length) {
        add('biomes', 'biomes', 'Нужен хотя бы один биом');
    } else if (Object.keys(content.biomes.biomes.at(-1)!.when ?? {}).length) {
        add(
            'biomes',
            `biomes[${content.biomes.biomes.length - 1}].when`,
            'Последний биом должен быть «по умолчанию» — с пустым when',
        );
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
    for (const [index, epoch] of (content.epochs.epochs ?? []).entries()) {
        if (index > 0 && epoch.year <= content.epochs.epochs[index - 1].year) {
            add(
                'epochs',
                `epochs[${index}].year`,
                'Годы эпох должны идти по возрастанию',
            );
        }

        if (epoch.next) {
            checkAmounts(
                'epochs',
                `epochs[${index}].next.cost`,
                epoch.next.cost,
            );
            epoch.next.buildings.forEach((b) =>
                checkBuilding(
                    'epochs',
                    `epochs[${index}].next.buildings`,
                    b.type,
                ),
            );
            (epoch.next.techs ?? []).forEach((t) => {
                checkTech('epochs', `epochs[${index}].next.techs`, t);

                if (techs.has(t) && order(techs.get(t)!.epoch) > index) {
                    add(
                        'epochs',
                        `epochs[${index}].next.techs`,
                        `Технология «${t}» из более поздней эпохи`,
                    );
                }
            });
        }

        if (!content.sounds.ambience?.[epoch.ambience]) {
            add(
                'epochs',
                `epochs[${index}].ambience`,
                `Нет фоновых звуков «${epoch.ambience}» в sounds.json`,
            );
        }
    }

    // techs
    for (const [index, tech] of techList.entries()) {
        const path = `techs[${index}]`;

        checkEpoch('techs', `${path}.epoch`, tech.epoch);
        checkAmounts('techs', `${path}.cost`, tech.cost);

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
            add('techs', tech.id, 'Технологии требуют друг друга по кругу');
            break;
        }
    }

    // blueprints
    for (const [index, blueprint] of (
        content.blueprints.blueprints ?? []
    ).entries()) {
        const path = `blueprints[${index}]`;

        checkEpoch('blueprints', `${path}.epoch`, blueprint.epoch);
        checkAmounts('blueprints', `${path}.cost`, blueprint.cost);
        (blueprint.buildings ?? []).forEach((b) =>
            checkBuilding('blueprints', `${path}.buildings`, b),
        );
    }

    // goals
    for (const [index, goal] of (content.goals.goals ?? []).entries()) {
        const path = `goals[${index}]`;
        const condition = goal.condition;

        checkEpoch('goals', `${path}.epoch`, goal.epoch);
        checkAmounts('goals', `${path}.reward`, goal.reward);

        if (condition?.type === 'building') {
            checkBuilding(
                'goals',
                `${path}.condition.building`,
                condition.building,
            );
        } else if (condition?.type === 'epoch') {
            checkEpoch('goals', `${path}.condition.epoch`, condition.epoch);
        } else if (condition?.type === 'tech') {
            checkTech('goals', `${path}.condition.tech`, condition.tech);
        } else if (
            condition?.type === 'resource' &&
            !resources.has(condition.resource)
        ) {
            add(
                'goals',
                `${path}.condition.resource`,
                `Нет такого ресурса «${condition.resource}»`,
            );
        }
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
    const roles = new Map<string, string>();

    for (const [key, building] of Object.entries(content.buildings)) {
        const file = `buildings/${key}`;

        if (building.id !== key) {
            add(
                file,
                'id',
                `id «${building.id}» должен совпадать с именем файла «${key}»`,
            );
        }

        if (building.role) {
            if (roles.has(building.role)) {
                add(
                    file,
                    'role',
                    `Роль «${building.role}» уже у здания «${roles.get(building.role)}»`,
                );
            }

            roles.set(building.role, key);
        }

        if (!(
            building.size?.w >= 1 &&
            building.size?.w <= 4 &&
            building.size?.h >= 1 &&
            building.size?.h <= 4
        )) {
            add(file, 'size', 'Размер — от 1×1 до 4×4');
        }

        for (const biome of building.placement?.biomes ?? []) {
            if (!biomes.has(biome)) {
                add(file, 'placement.biomes', `Нет биома «${biome}»`);
            }
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
                        `Технология «${level.tech}» из более поздней эпохи, чем уровень`,
                    );
                }
            }

            checkAmounts(file, `${path}.cost`, level.cost);
            checkAmounts(file, `${path}.upgrade`, level.upgrade);
            checkAmounts(
                file,
                `${path}.effects.produces`,
                level.effects?.produces,
            );
            checkAmounts(
                file,
                `${path}.effects.consumes`,
                level.effects?.consumes,
            );

            for (const target of level.effects?.boost?.targets ?? []) {
                checkBuilding(file, `${path}.effects.boost.targets`, target);
            }

            if (!Array.isArray(level.model?.parts)) {
                add(file, `${path}.model.parts`, 'Нужен массив деталей модели');
            }
        });
    }

    for (const role of ['road', 'center'] as const) {
        if (!roles.has(role)) {
            add('buildings', '', `Нужно здание с ролью «${role}»`);
        }
    }

    return issues;
}
