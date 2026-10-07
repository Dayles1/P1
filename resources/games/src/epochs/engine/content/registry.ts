/**
 * The loaded content with lookups the engine needs, plus validation of
 * the cross-file references (a building's era exists, a cost names a real
 * resource, …). The Workshop runs the same validation on every edit.
 */

import type {
    Amounts,
    BiomeDef,
    BuildingDef,
    ContentBundle,
    EpochDef,
    LevelDef,
    NpcTypeDef,
    Palette,
    ResourceDef,
    SeasonDef,
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
    readonly npcTypes: NpcTypeDef[];

    private readonly epochIndex = new Map<string, number>();
    private readonly biomeIndex = new Map<string, number>();
    private readonly buildingById = new Map<string, BuildingDef>();

    constructor(bundle: ContentBundle) {
        this.bundle = bundle;
        this.epochs = bundle.epochs.epochs;
        this.resources = bundle.resources.resources;
        this.biomes = bundle.biomes.biomes;
        this.seasons = bundle.climate.seasons;
        this.weather = bundle.climate.weather;
        this.npcTypes = bundle.npcs.types;
        this.buildings = Object.values(bundle.buildings).sort(
            (a, b) =>
                this.epochOrder(a.epoch) - this.epochOrder(b.epoch) ||
                a.id.localeCompare(b.id),
        );

        this.epochs.forEach((epoch, index) =>
            this.epochIndex.set(epoch.id, index),
        );
        this.biomes.forEach((biome, index) =>
            this.biomeIndex.set(biome.id, index),
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

    palette(epochIndex: number): Palette {
        return this.epoch(epochIndex).palette;
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

    level(def: BuildingDef, level: number): LevelDef {
        return def.levels[
            Math.max(0, Math.min(def.levels.length - 1, level - 1))
        ];
    }

    nameOf(def: BuildingDef, epochIndex: number): string {
        let name = def.name;

        for (const epoch of this.epochs.slice(0, epochIndex + 1)) {
            name = def.names[epoch.id] ?? name;
        }

        return name;
    }

    resource(id: string): ResourceDef | undefined {
        return this.resources.find((resource) => resource.id === id);
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
    const epochs = new Set((content.epochs.epochs ?? []).map((e) => e.id));
    const biomes = new Set((content.biomes.biomes ?? []).map((b) => b.id));
    const seasons = new Set((content.climate.seasons ?? []).map((s) => s.id));
    const weather = new Set((content.climate.weather ?? []).map((w) => w.id));
    const sounds = new Set(Object.keys(content.sounds.presets ?? {}));
    const buildings = new Set(Object.keys(content.buildings));

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

    if (!epochs.has(world.start?.epoch)) {
        add('world', 'start.epoch', `Нет эпохи «${world.start?.epoch}»`);
    }

    checkAmounts('world', 'start.resources', world.start?.resources);

    for (const [index, start] of (world.start?.buildings ?? []).entries()) {
        if (!buildings.has(start.type)) {
            add(
                'world',
                `start.buildings[${index}]`,
                `Нет здания «${start.type}»`,
            );
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
        (event.epochs ?? [])
            .filter((e) => !epochs.has(e))
            .forEach((e) =>
                add(
                    'world',
                    `events.list[${index}].epochs`,
                    `Нет эпохи «${e}»`,
                ),
            );
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
            epoch.next.buildings
                .filter((b) => !buildings.has(b.type))
                .forEach((b) =>
                    add(
                        'epochs',
                        `epochs[${index}].next.buildings`,
                        `Нет здания «${b.type}»`,
                    ),
                );
        }

        if (!content.sounds.ambience?.[epoch.ambience]) {
            add(
                'epochs',
                `epochs[${index}].ambience`,
                `Нет фоновых звуков «${epoch.ambience}» в sounds.json`,
            );
        }
    }

    // npcs
    for (const [index, type] of (content.npcs.types ?? []).entries()) {
        type.epochs
            .filter((e) => !epochs.has(e))
            .forEach((e) =>
                add('npcs', `types[${index}].epochs`, `Нет эпохи «${e}»`),
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
    for (const [key, building] of Object.entries(content.buildings)) {
        const file = `buildings/${key}`;

        if (building.id !== key) {
            add(
                file,
                'id',
                `id «${building.id}» должен совпадать с именем файла «${key}»`,
            );
        }

        if (!epochs.has(building.epoch)) {
            add(file, 'epoch', `Нет эпохи «${building.epoch}»`);
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

        for (const [epoch, cost] of Object.entries(
            building.costByEpoch ?? {},
        )) {
            if (!epochs.has(epoch)) {
                add(file, `costByEpoch.${epoch}`, `Нет эпохи «${epoch}»`);
            }

            checkAmounts(file, `costByEpoch.${epoch}`, cost);
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

        building.levels.forEach((level, index) => {
            const path = `levels[${index}]`;

            if (level.level !== index + 1) {
                add(
                    file,
                    `${path}.level`,
                    `Уровни нумеруются по порядку: ожидался ${index + 1}`,
                );
            }

            if (level.requiresEpoch && !epochs.has(level.requiresEpoch)) {
                add(
                    file,
                    `${path}.requiresEpoch`,
                    `Нет эпохи «${level.requiresEpoch}»`,
                );
            }

            checkAmounts(file, `${path}.cost`, level.cost);
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
                if (!buildings.has(target)) {
                    add(
                        file,
                        `${path}.effects.boost.targets`,
                        `Нет здания «${target}»`,
                    );
                }
            }

            if (!Array.isArray(level.model?.parts)) {
                add(file, `${path}.model.parts`, 'Нужен массив деталей модели');
            }
        });
    }

    return issues;
}
