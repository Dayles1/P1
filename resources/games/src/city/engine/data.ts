/**
 * Everything the city is made of: eras, buildings and technologies. The
 * simulation (sim.ts) and the renderer only read from here, so balancing
 * the game is editing numbers in this file.
 */

export type Resource = 'food' | 'wood' | 'stone' | 'gold' | 'science';

export type Cost = Partial<Record<Resource, number>>;

export const RESOURCES: {
    id: Resource;
    icon: string;
    name: string;
    capped: boolean;
}[] = [
    { id: 'food', icon: '🌾', name: 'Еда', capped: true },
    { id: 'wood', icon: '🌲', name: 'Дерево', capped: true },
    { id: 'stone', icon: '🧱', name: 'Камень', capped: true },
    { id: 'gold', icon: '💰', name: 'Золото', capped: false },
    { id: 'science', icon: '📜', name: 'Знания', capped: false },
];

export interface Epoch {
    year: number;
    name: string;
    /** What the era is about, shown when the city enters it. */
    tagline: string;
    /** Half-width of the buildable land around the centre of the map. */
    territory: number;
    /** What it takes to leave this era for the next one. */
    next?: { population: number; tech: string; cost: Cost };
}

export const EPOCHS: Epoch[] = [
    {
        year: 1000,
        name: 'Раннее поселение',
        tagline:
            'Несколько семей, лес вокруг и дом старейшины. Всё только начинается.',
        territory: 7,
        next: {
            population: 25,
            tech: 'council',
            cost: { wood: 150, stone: 50, gold: 60 },
        },
    },
    {
        year: 1100,
        name: 'Деревня',
        tagline:
            'Появляются рынок, часовня и первая школа. Поселение становится деревней.',
        territory: 9,
        next: {
            population: 70,
            tech: 'charter',
            cost: { wood: 300, stone: 200, gold: 250, food: 200 },
        },
    },
    {
        year: 1300,
        name: 'Средневековый город',
        tagline:
            'Каменные дома, гильдии и рудники. За стенами — настоящий город.',
        territory: 11,
        next: {
            population: 150,
            tech: 'royal_charter',
            cost: { wood: 400, stone: 600, gold: 600 },
        },
    },
    {
        year: 1450,
        name: 'Королевство',
        tagline:
            'Ратуша, соборы и банки. Город становится столицей королевства.',
        territory: 13,
        next: {
            population: 280,
            tech: 'printing',
            cost: { wood: 600, stone: 900, gold: 1200 },
        },
    },
    {
        year: 1600,
        name: 'Раннее новое время',
        tagline:
            'Университеты, мануфактуры и морская торговля открывают новый мир.',
        territory: 15,
        next: {
            population: 450,
            tech: 'scientific_method',
            cost: { wood: 800, stone: 1200, gold: 2000 },
        },
    },
    {
        year: 1700,
        name: 'Торговый город',
        tagline: 'Торговые дома, сады и биржа. Город живёт торговлей.',
        territory: 17,
        next: {
            population: 700,
            tech: 'steam_engine',
            cost: { wood: 1200, stone: 2000, gold: 3500 },
        },
    },
    {
        year: 1800,
        name: 'Индустриальная эпоха',
        tagline: 'Фабрики, дым над трубами и железная дорога. Пар меняет всё.',
        territory: 19,
        next: {
            population: 1100,
            tech: 'electricity',
            cost: { stone: 3000, gold: 6000 },
        },
    },
    {
        year: 1900,
        name: 'Современный город',
        tagline:
            'Электричество, автомобили и многоэтажки. Город светится по ночам.',
        territory: 21,
        next: {
            population: 1800,
            tech: 'computers',
            cost: { stone: 5000, gold: 10000 },
        },
    },
    {
        year: 2000,
        name: 'Мегаполис',
        tagline: 'Небоскрёбы, технопарки и чистая энергия. Город будущего.',
        territory: 23,
    },
];

export type Category =
    | 'housing'
    | 'food'
    | 'resources'
    | 'industry'
    | 'trade'
    | 'civic'
    | 'military'
    | 'infrastructure';

export const CATEGORIES: { id: Category; name: string; icon: string }[] = [
    { id: 'housing', name: 'Жильё', icon: '🏠' },
    { id: 'food', name: 'Еда', icon: '🌾' },
    { id: 'resources', name: 'Добыча', icon: '⛏️' },
    { id: 'industry', name: 'Производство', icon: '⚒️' },
    { id: 'trade', name: 'Торговля', icon: '💰' },
    { id: 'civic', name: 'Город', icon: '⛪' },
    { id: 'military', name: 'Оборона', icon: '🛡️' },
    { id: 'infrastructure', name: 'Инфраструктура', icon: '🛤️' },
];

export type Shape =
    | 'road'
    | 'center'
    | 'house'
    | 'tower'
    | 'farm'
    | 'greenhouse'
    | 'lumber'
    | 'quarry'
    | 'mine'
    | 'well'
    | 'warehouse'
    | 'market'
    | 'chapel'
    | 'cathedral'
    | 'school'
    | 'university'
    | 'mill'
    | 'smithy'
    | 'factory'
    | 'barracks'
    | 'hall'
    | 'harbor'
    | 'trading'
    | 'park'
    | 'station'
    | 'power'
    | 'solar'
    | 'hospital'
    | 'office';

export type Terrain = 'forest' | 'rock' | 'water';

export interface BuildingDef {
    id: string;
    name: string;
    /** Later names: [from epoch, name]. A chapel stays, a barracks becomes a police station. */
    names?: [number, string][];
    icon: string;
    category: Category;
    shape: Shape;
    description: string;
    epoch: number;
    tech?: string;
    size: 1 | 2;
    cost: Cost;
    maxLevel: number;
    /** Not offered in the build menu (the town centre). */
    hidden?: boolean;
    unique?: boolean;
    /** Works without a road next to it. */
    noRoad?: boolean;
    workers?: number;
    housing?: number;
    /** Per second at level 1. */
    produces?: Cost;
    consumes?: Cost;
    storage?: number;
    defense?: number;
    power?: number;
    powerUse?: number;
    aura?: { radius: number; happiness: number };
    pollution?: { radius: number; amount: number };
    /** Extra output for each tile of this terrain within 2 tiles. */
    nearby?: {
        terrain: Terrain;
        perTile: number;
        max: number;
        required?: boolean;
    };
    /** Raises the output of other buildings around it. */
    boost?: { targets: string[]; radius: number; percent: number };
    /** City-wide bonus to a resource while it works. */
    globalBonus?: { resource: Resource; percent: number };
}

export const BUILDINGS: BuildingDef[] = [
    // —— Infrastructure ——
    {
        id: 'road',
        name: 'Дорога',
        icon: '🛤️',
        category: 'infrastructure',
        shape: 'road',
        description:
            'Соединяет здания с центром города. Здание без дороги к центру не работает.',
        epoch: 0,
        size: 1,
        cost: { wood: 2 },
        maxLevel: 1,
        noRoad: true,
    },
    {
        id: 'center',
        name: 'Дом старейшины',
        names: [
            [1, 'Общинный дом'],
            [2, 'Замок'],
            [3, 'Королевский дворец'],
            [5, 'Дворец губернатора'],
            [6, 'Мэрия'],
            [8, 'Городская администрация'],
        ],
        icon: '🏛️',
        category: 'civic',
        shape: 'center',
        description:
            'Сердце города: даёт жильё, склад, немного знаний и защиту. Растёт вместе с эпохой.',
        epoch: 0,
        size: 2,
        cost: {},
        maxLevel: 1,
        hidden: true,
        unique: true,
        noRoad: true,
        housing: 8,
        storage: 300,
        produces: { science: 0.2, gold: 0.2, wood: 0.15 },
        defense: 10,
        aura: { radius: 4, happiness: 6 },
    },
    {
        id: 'warehouse',
        name: 'Склад',
        names: [
            [6, 'Товарный склад'],
            [7, 'Логистический центр'],
        ],
        icon: '📦',
        category: 'infrastructure',
        shape: 'warehouse',
        description: 'Увеличивает запас еды, дерева и камня.',
        epoch: 0,
        tech: 'carpentry',
        size: 1,
        cost: { wood: 60, stone: 20 },
        maxLevel: 3,
        workers: 1,
        storage: 300,
    },
    {
        id: 'station',
        name: 'Вокзал',
        icon: '🚂',
        category: 'infrastructure',
        shape: 'station',
        description:
            'Железная дорога связывает город с миром: +15% ко всему золоту.',
        epoch: 6,
        tech: 'railways',
        size: 2,
        cost: { stone: 1500, gold: 2000 },
        maxLevel: 3,
        unique: true,
        workers: 15,
        produces: { gold: 5 },
        globalBonus: { resource: 'gold', percent: 15 },
    },
    {
        id: 'power_plant',
        name: 'Электростанция',
        icon: '🏭',
        category: 'infrastructure',
        shape: 'power',
        description:
            'Даёт энергию современным зданиям, но загрязняет округу и стоит золота.',
        epoch: 7,
        size: 2,
        cost: { stone: 2000, gold: 2500 },
        maxLevel: 3,
        workers: 20,
        power: 40,
        consumes: { gold: 2 },
        pollution: { radius: 5, amount: 20 },
    },
    {
        id: 'solar',
        name: 'Солнечная станция',
        icon: '☀️',
        category: 'infrastructure',
        shape: 'solar',
        description: 'Чистая энергия без дыма.',
        epoch: 8,
        tech: 'green_energy',
        size: 2,
        cost: { stone: 1000, gold: 3000 },
        maxLevel: 3,
        workers: 2,
        power: 25,
    },

    // —— Housing ——
    {
        id: 'house',
        name: 'Хижина',
        names: [
            [1, 'Изба'],
            [3, 'Фахверковый дом'],
            [5, 'Городской дом'],
            [7, 'Коттедж'],
        ],
        icon: '🏡',
        category: 'housing',
        shape: 'house',
        description:
            'Жильё для нескольких семей. Жителям нужны еда, работа и что-то рядом для души.',
        epoch: 0,
        size: 1,
        cost: { wood: 20 },
        maxLevel: 3,
        housing: 6,
    },
    {
        id: 'stone_house',
        name: 'Каменный дом',
        names: [[5, 'Особняк']],
        icon: '🏠',
        category: 'housing',
        shape: 'house',
        description: 'Прочный дом из камня — вмещает гораздо больше людей.',
        epoch: 2,
        size: 1,
        cost: { wood: 40, stone: 60 },
        maxLevel: 3,
        housing: 16,
    },
    {
        id: 'tenement',
        name: 'Доходный дом',
        icon: '🏘️',
        category: 'housing',
        shape: 'tower',
        description: 'Многоквартирный кирпичный дом для рабочих фабрик.',
        epoch: 6,
        size: 1,
        cost: { stone: 200, gold: 150 },
        maxLevel: 3,
        housing: 40,
    },
    {
        id: 'apartment',
        name: 'Многоэтажка',
        icon: '🏢',
        category: 'housing',
        shape: 'tower',
        description: 'Высокий жилой дом. Нужна энергия.',
        epoch: 7,
        size: 1,
        cost: { stone: 400, gold: 400 },
        maxLevel: 3,
        housing: 90,
        powerUse: 3,
    },
    {
        id: 'skyscraper',
        name: 'Жилой небоскрёб',
        icon: '🌆',
        category: 'housing',
        shape: 'tower',
        description: 'Целый район в одной башне. Много энергии.',
        epoch: 8,
        size: 2,
        cost: { stone: 1500, gold: 2000 },
        maxLevel: 3,
        housing: 320,
        powerUse: 10,
    },

    // —— Food ——
    {
        id: 'farm',
        name: 'Ферма',
        names: [[6, 'Агроферма']],
        icon: '🌾',
        category: 'food',
        shape: 'farm',
        description:
            'Поля и амбар. Кормит около 35 жителей; мельница рядом — ещё больше.',
        epoch: 0,
        size: 2,
        cost: { wood: 30 },
        maxLevel: 3,
        workers: 4,
        produces: { food: 1.4 },
    },
    {
        id: 'mill',
        name: 'Мельница',
        icon: '🌬️',
        category: 'food',
        shape: 'mill',
        description: '+30% еды фермам в радиусе 3 клеток.',
        epoch: 1,
        tech: 'milling',
        size: 1,
        cost: { wood: 70, stone: 20 },
        maxLevel: 3,
        workers: 2,
        boost: { targets: ['farm'], radius: 3, percent: 30 },
    },
    {
        id: 'harbor',
        name: 'Порт',
        icon: '⚓',
        category: 'food',
        shape: 'harbor',
        description: 'Рыба и заморская торговля. Ставится у воды.',
        epoch: 4,
        tech: 'navigation',
        size: 2,
        cost: { wood: 400, stone: 300 },
        maxLevel: 3,
        workers: 10,
        produces: { food: 3, gold: 5 },
        nearby: { terrain: 'water', perTile: 0, max: 0, required: true },
    },
    {
        id: 'greenhouse',
        name: 'Агрокомплекс',
        icon: '🥬',
        category: 'food',
        shape: 'greenhouse',
        description: 'Теплицы круглый год. Нужна энергия.',
        epoch: 7,
        tech: 'agro',
        size: 2,
        cost: { stone: 800, gold: 1000 },
        maxLevel: 3,
        workers: 8,
        produces: { food: 10 },
        powerUse: 3,
    },

    // —— Resources ——
    {
        id: 'lumber',
        name: 'Лесопилка',
        icon: '🏕️',
        category: 'resources',
        shape: 'lumber',
        description:
            'Дерево. Чем больше леса вокруг (2 клетки), тем больше выработка.',
        epoch: 0,
        size: 1,
        cost: { gold: 15 },
        maxLevel: 3,
        workers: 3,
        produces: { wood: 0.7 },
        nearby: { terrain: 'forest', perTile: 0.08, max: 0.8 },
    },
    {
        id: 'quarry',
        name: 'Каменоломня',
        icon: '🧱',
        category: 'resources',
        shape: 'quarry',
        description:
            'Камень. Ставьте рядом со скалами — выработка заметно выше.',
        epoch: 0,
        size: 1,
        cost: { wood: 30 },
        maxLevel: 3,
        workers: 4,
        produces: { stone: 0.4 },
        nearby: { terrain: 'rock', perTile: 0.1, max: 0.7 },
    },
    {
        id: 'mine',
        name: 'Рудник',
        icon: '⛏️',
        category: 'resources',
        shape: 'mine',
        description: 'Камень и золото из недр. Только рядом со скалами.',
        epoch: 2,
        tech: 'mining',
        size: 1,
        cost: { wood: 80, stone: 60 },
        maxLevel: 3,
        workers: 5,
        produces: { stone: 0.6, gold: 0.5 },
        nearby: { terrain: 'rock', perTile: 0.05, max: 0.4, required: true },
    },

    // —— Industry ——
    {
        id: 'smithy',
        name: 'Кузница',
        icon: '⚒️',
        category: 'industry',
        shape: 'smithy',
        description: 'Превращает дерево в инструменты на продажу.',
        epoch: 1,
        tech: 'metallurgy',
        size: 1,
        cost: { wood: 40, stone: 50 },
        maxLevel: 3,
        workers: 3,
        consumes: { wood: 0.4 },
        produces: { gold: 0.9 },
    },
    {
        id: 'workshop',
        name: 'Мастерская',
        icon: '🧵',
        category: 'industry',
        shape: 'smithy',
        description: 'Ремесленники гильдий: дерево и камень в дорогие товары.',
        epoch: 2,
        tech: 'guilds',
        size: 1,
        cost: { wood: 60, stone: 80, gold: 40 },
        maxLevel: 3,
        workers: 4,
        consumes: { wood: 0.6, stone: 0.3 },
        produces: { gold: 2 },
    },
    {
        id: 'manufactory',
        name: 'Мануфактура',
        icon: '🏗️',
        category: 'industry',
        shape: 'factory',
        description: 'Разделение труда: много товаров из дерева и камня.',
        epoch: 4,
        tech: 'manufacture',
        size: 2,
        cost: { wood: 300, stone: 400, gold: 300 },
        maxLevel: 3,
        workers: 12,
        consumes: { wood: 1.5, stone: 0.5 },
        produces: { gold: 6 },
    },
    {
        id: 'factory',
        name: 'Фабрика',
        icon: '🏭',
        category: 'industry',
        shape: 'factory',
        description: 'Огромная выработка, но дым портит настроение соседям.',
        epoch: 6,
        size: 2,
        cost: { stone: 1200, gold: 1500 },
        maxLevel: 3,
        workers: 30,
        consumes: { wood: 2, stone: 1 },
        produces: { gold: 20 },
        pollution: { radius: 4, amount: 18 },
    },
    {
        id: 'office',
        name: 'Бизнес-центр',
        icon: '🏙️',
        category: 'industry',
        shape: 'office',
        description: 'Стекло, офисы и большие деньги. Нужна энергия.',
        epoch: 8,
        size: 2,
        cost: { stone: 2500, gold: 4000 },
        maxLevel: 3,
        workers: 40,
        produces: { gold: 45 },
        powerUse: 8,
    },

    // —— Trade ——
    {
        id: 'market',
        name: 'Рынок',
        names: [
            [3, 'Большой рынок'],
            [6, 'Пассаж'],
            [7, 'Торговый центр'],
        ],
        icon: '🧺',
        category: 'trade',
        shape: 'market',
        description: 'Золото от торговли и радость покупателей вокруг.',
        epoch: 1,
        size: 2,
        cost: { wood: 80, stone: 40 },
        maxLevel: 3,
        workers: 4,
        produces: { gold: 0.8 },
        aura: { radius: 4, happiness: 8 },
    },
    {
        id: 'trading_house',
        name: 'Торговый дом',
        names: [[7, 'Банк']],
        icon: '🏦',
        category: 'trade',
        shape: 'trading',
        description: 'Купцы и векселя. Много золота.',
        epoch: 5,
        tech: 'stock_exchange',
        size: 2,
        cost: { stone: 800, gold: 1000 },
        maxLevel: 3,
        workers: 10,
        produces: { gold: 9 },
    },

    // —— Civic ——
    {
        id: 'well',
        name: 'Колодец',
        names: [[5, 'Фонтан']],
        icon: '⛲',
        category: 'civic',
        shape: 'well',
        description: 'Вода рядом с домом — жители довольнее. Дорога не нужна.',
        epoch: 0,
        size: 1,
        cost: { wood: 5, stone: 15 },
        maxLevel: 3,
        noRoad: true,
        aura: { radius: 3, happiness: 8 },
    },
    {
        id: 'chapel',
        name: 'Часовня',
        names: [[4, 'Церковь']],
        icon: '⛪',
        category: 'civic',
        shape: 'chapel',
        description: 'Заметно поднимает настроение жителей вокруг.',
        epoch: 1,
        size: 1,
        cost: { wood: 40, stone: 60, gold: 20 },
        maxLevel: 3,
        workers: 1,
        aura: { radius: 4, happiness: 12 },
    },
    {
        id: 'school',
        name: 'Монастырская школа',
        names: [
            [4, 'Школа'],
            [7, 'Гимназия'],
        ],
        icon: '📚',
        category: 'civic',
        shape: 'school',
        description: 'Даёт знания для исследований.',
        epoch: 1,
        size: 1,
        cost: { wood: 60, stone: 30, gold: 30 },
        maxLevel: 3,
        workers: 2,
        produces: { science: 0.4 },
        aura: { radius: 3, happiness: 4 },
    },
    {
        id: 'town_hall',
        name: 'Ратуша',
        icon: '🕰️',
        category: 'civic',
        shape: 'hall',
        description: 'Управление городом: налоги, порядок и немного знаний.',
        epoch: 3,
        tech: 'administration',
        size: 2,
        cost: { wood: 150, stone: 400, gold: 300 },
        maxLevel: 3,
        unique: true,
        workers: 6,
        produces: { gold: 2, science: 0.3 },
        aura: { radius: 6, happiness: 10 },
    },
    {
        id: 'cathedral',
        name: 'Собор',
        icon: '🕍',
        category: 'civic',
        shape: 'cathedral',
        description: 'Гордость города. Огромная радость в большом радиусе.',
        epoch: 3,
        tech: 'gothic',
        size: 2,
        cost: { stone: 600, gold: 400 },
        maxLevel: 3,
        workers: 4,
        aura: { radius: 7, happiness: 20 },
    },
    {
        id: 'university',
        name: 'Университет',
        icon: '🎓',
        category: 'civic',
        shape: 'university',
        description: 'Много знаний для новых технологий.',
        epoch: 4,
        tech: 'academia',
        size: 2,
        cost: { stone: 500, gold: 600 },
        maxLevel: 3,
        workers: 8,
        produces: { science: 2.5 },
        aura: { radius: 4, happiness: 6 },
    },
    {
        id: 'park',
        name: 'Сад',
        names: [[6, 'Парк']],
        icon: '🌳',
        category: 'civic',
        shape: 'park',
        description: 'Зелень и тень. Дорога не нужна.',
        epoch: 5,
        tech: 'landscaping',
        size: 1,
        cost: { stone: 50, gold: 150 },
        maxLevel: 3,
        noRoad: true,
        aura: { radius: 4, happiness: 14 },
    },
    {
        id: 'hospital',
        name: 'Больница',
        icon: '🏥',
        category: 'civic',
        shape: 'hospital',
        description: 'Здоровые жители — счастливые жители. Нужна энергия.',
        epoch: 7,
        tech: 'medicine',
        size: 2,
        cost: { stone: 1500, gold: 2000 },
        maxLevel: 3,
        workers: 15,
        aura: { radius: 6, happiness: 18 },
        powerUse: 4,
    },
    {
        id: 'tech_park',
        name: 'Технопарк',
        icon: '🧪',
        category: 'civic',
        shape: 'office',
        description: 'Лаборатории и стартапы: очень много знаний.',
        epoch: 8,
        tech: 'ai',
        size: 2,
        cost: { stone: 2500, gold: 5000 },
        maxLevel: 3,
        workers: 30,
        produces: { science: 15 },
        powerUse: 8,
    },

    // —— Military ——
    {
        id: 'barracks',
        name: 'Казармы',
        names: [[7, 'Полицейский участок']],
        icon: '🛡️',
        category: 'military',
        shape: 'barracks',
        description: 'Защищают от набегов и дают жителям чувство безопасности.',
        epoch: 2,
        tech: 'militia',
        size: 2,
        cost: { wood: 80, stone: 120, gold: 60 },
        maxLevel: 3,
        workers: 6,
        consumes: { food: 0.3 },
        defense: 25,
        aura: { radius: 5, happiness: 6 },
    },
];

export const BUILDING: Record<string, BuildingDef> = Object.fromEntries(
    BUILDINGS.map((def) => [def.id, def]),
);

export interface TechDef {
    id: string;
    name: string;
    icon: string;
    epoch: number;
    cost: number;
    requires?: string[];
    description: string;
    /** The tech the era needs before the city may leave it. */
    key?: boolean;
    bonus?: Partial<Record<Resource | 'housing' | 'happiness', number>>;
}

export const TECHS: TechDef[] = [
    {
        id: 'agriculture',
        name: 'Трёхполье',
        icon: '🌱',
        epoch: 0,
        cost: 15,
        description: '+20% еды.',
        bonus: { food: 20 },
    },
    {
        id: 'carpentry',
        name: 'Плотницкое дело',
        icon: '🔨',
        epoch: 0,
        cost: 15,
        description: 'Открывает склад. +15% дерева.',
        bonus: { wood: 15 },
    },
    {
        id: 'masonry',
        name: 'Каменотёсы',
        icon: '🧱',
        epoch: 0,
        cost: 25,
        description: '+20% камня.',
        bonus: { stone: 20 },
    },
    {
        id: 'council',
        name: 'Совет старейшин',
        icon: '🪶',
        epoch: 0,
        cost: 40,
        requires: ['agriculture', 'carpentry'],
        description: 'Нужен для перехода в эпоху «Деревня».',
        key: true,
    },

    {
        id: 'milling',
        name: 'Мельничное дело',
        icon: '🌬️',
        epoch: 1,
        cost: 50,
        description: 'Открывает мельницу.',
    },
    {
        id: 'metallurgy',
        name: 'Металлургия',
        icon: '🔥',
        epoch: 1,
        cost: 60,
        description: 'Открывает кузницу.',
    },
    {
        id: 'writing',
        name: 'Письменность',
        icon: '✒️',
        epoch: 1,
        cost: 60,
        description: '+25% знаний.',
        bonus: { science: 25 },
    },
    {
        id: 'charter',
        name: 'Городская хартия',
        icon: '📜',
        epoch: 1,
        cost: 120,
        requires: ['writing'],
        description: 'Нужна для перехода в «Средневековый город».',
        key: true,
    },

    {
        id: 'militia',
        name: 'Ополчение',
        icon: '🗡️',
        epoch: 2,
        cost: 120,
        description: 'Открывает казармы.',
    },
    {
        id: 'guilds',
        name: 'Гильдии',
        icon: '🧵',
        epoch: 2,
        cost: 140,
        description: 'Открывает мастерскую.',
    },
    {
        id: 'mining',
        name: 'Горное дело',
        icon: '⛏️',
        epoch: 2,
        cost: 150,
        description: 'Открывает рудник.',
    },
    {
        id: 'architecture',
        name: 'Зодчество',
        icon: '📐',
        epoch: 2,
        cost: 180,
        description: '+15% вместимости жилья.',
        bonus: { housing: 15 },
    },
    {
        id: 'royal_charter',
        name: 'Королевская грамота',
        icon: '👑',
        epoch: 2,
        cost: 300,
        requires: ['guilds'],
        description: 'Нужна для перехода в «Королевство».',
        key: true,
    },

    {
        id: 'administration',
        name: 'Управление',
        icon: '🕰️',
        epoch: 3,
        cost: 300,
        description: 'Открывает ратушу.',
    },
    {
        id: 'gothic',
        name: 'Готика',
        icon: '🕍',
        epoch: 3,
        cost: 350,
        description: 'Открывает собор.',
    },
    {
        id: 'banking',
        name: 'Банковское дело',
        icon: '🏦',
        epoch: 3,
        cost: 400,
        description: '+20% золота.',
        bonus: { gold: 20 },
    },
    {
        id: 'printing',
        name: 'Книгопечатание',
        icon: '📖',
        epoch: 3,
        cost: 600,
        requires: ['administration'],
        description: '+20% знаний. Нужно для «Раннего нового времени».',
        key: true,
        bonus: { science: 20 },
    },

    {
        id: 'academia',
        name: 'Академии',
        icon: '🎓',
        epoch: 4,
        cost: 600,
        description: 'Открывает университет.',
    },
    {
        id: 'manufacture',
        name: 'Мануфактуры',
        icon: '🏗️',
        epoch: 4,
        cost: 700,
        description: 'Открывает мануфактуру.',
    },
    {
        id: 'navigation',
        name: 'Навигация',
        icon: '🧭',
        epoch: 4,
        cost: 700,
        description: 'Открывает порт.',
    },
    {
        id: 'scientific_method',
        name: 'Научный метод',
        icon: '🔭',
        epoch: 4,
        cost: 1200,
        requires: ['academia'],
        description: 'Нужен для «Торгового города».',
        key: true,
    },

    {
        id: 'stock_exchange',
        name: 'Биржа',
        icon: '📈',
        epoch: 5,
        cost: 1200,
        description: 'Открывает торговый дом.',
    },
    {
        id: 'landscaping',
        name: 'Садовое искусство',
        icon: '🌳',
        epoch: 5,
        cost: 1000,
        description: 'Открывает сады.',
    },
    {
        id: 'crop_rotation',
        name: 'Севооборот',
        icon: '🥕',
        epoch: 5,
        cost: 1200,
        description: '+25% еды.',
        bonus: { food: 25 },
    },
    {
        id: 'steam_engine',
        name: 'Паровая машина',
        icon: '♨️',
        epoch: 5,
        cost: 2000,
        requires: ['stock_exchange'],
        description: 'Нужна для «Индустриальной эпохи».',
        key: true,
    },

    {
        id: 'railways',
        name: 'Железные дороги',
        icon: '🚂',
        epoch: 6,
        cost: 2000,
        description: 'Открывает вокзал.',
    },
    {
        id: 'mass_production',
        name: 'Конвейер',
        icon: '⚙️',
        epoch: 6,
        cost: 2500,
        description: '+20% золота.',
        bonus: { gold: 20 },
    },
    {
        id: 'sanitation',
        name: 'Канализация',
        icon: '🚰',
        epoch: 6,
        cost: 2200,
        description: '+8 к счастью всего города.',
        bonus: { happiness: 8 },
    },
    {
        id: 'electricity',
        name: 'Электричество',
        icon: '💡',
        epoch: 6,
        cost: 4000,
        requires: ['railways'],
        description: 'Нужно для «Современного города».',
        key: true,
    },

    {
        id: 'medicine',
        name: 'Медицина',
        icon: '💊',
        epoch: 7,
        cost: 4000,
        description: 'Открывает больницу.',
    },
    {
        id: 'agro',
        name: 'Агротехника',
        icon: '🚜',
        epoch: 7,
        cost: 4000,
        description: 'Открывает агрокомплекс.',
    },
    {
        id: 'automobiles',
        name: 'Автомобили',
        icon: '🚗',
        epoch: 7,
        cost: 5000,
        description: '+15% золота.',
        bonus: { gold: 15 },
    },
    {
        id: 'computers',
        name: 'Компьютеры',
        icon: '💻',
        epoch: 7,
        cost: 8000,
        requires: ['medicine'],
        description: 'Нужны для «Мегаполиса».',
        key: true,
    },

    {
        id: 'internet',
        name: 'Интернет',
        icon: '🌐',
        epoch: 8,
        cost: 9000,
        description: '+25% золота.',
        bonus: { gold: 25 },
    },
    {
        id: 'green_energy',
        name: 'Зелёная энергия',
        icon: '♻️',
        epoch: 8,
        cost: 9000,
        description: 'Открывает солнечную станцию.',
    },
    {
        id: 'ai',
        name: 'Искусственный интеллект',
        icon: '🤖',
        epoch: 8,
        cost: 12000,
        description: 'Открывает технопарк. +40% знаний.',
        bonus: { science: 40 },
    },
    {
        id: 'smart_city',
        name: 'Умный город',
        icon: '✨',
        epoch: 8,
        cost: 20000,
        requires: ['ai', 'internet'],
        description: 'Вершина развития: +15 к счастью.',
        bonus: { happiness: 15 },
    },
];

export const TECH: Record<string, TechDef> = Object.fromEntries(
    TECHS.map((tech) => [tech.id, tech]),
);

/** Tutorial goals, done in order; each gives a small reward. */
export const GOALS: { id: string; text: string; hint: string; reward: Cost }[] =
    [
        {
            id: 'roads',
            text: 'Проложите 6 клеток дороги',
            hint: 'Дорога должна идти от центра города — без неё здания не работают.',
            reward: { wood: 20 },
        },
        {
            id: 'houses',
            text: 'Постройте 3 хижины',
            hint: 'Жилище даёт новых жителей. Ставьте его вдоль дороги.',
            reward: { food: 30 },
        },
        {
            id: 'farm',
            text: 'Постройте ферму',
            hint: 'Каждый житель ест. Одна ферма кормит около 35 человек.',
            reward: { wood: 30 },
        },
        {
            id: 'lumber',
            text: 'Постройте лесопилку у леса',
            hint: 'Чем больше деревьев в двух клетках вокруг — тем больше дерева.',
            reward: { gold: 20 },
        },
        {
            id: 'quarry',
            text: 'Постройте каменоломню у скал',
            hint: 'Серые камни на карте — скалы. Каменоломня рядом с ними работает лучше.',
            reward: { wood: 40 },
        },
        {
            id: 'tech',
            text: 'Изучите технологию',
            hint: 'Откройте «Технологии» — знания копятся сами.',
            reward: { gold: 30 },
        },
        {
            id: 'upgrade',
            text: 'Улучшите любое здание',
            hint: 'Выберите здание и нажмите «Улучшить» — оно станет красивее и полезнее.',
            reward: { stone: 30 },
        },
        {
            id: 'well',
            text: 'Постройте колодец рядом с домами',
            hint: 'Довольные жители растут быстрее.',
            reward: { food: 40 },
        },
        {
            id: 'population',
            text: 'Достигните 25 жителей',
            hint: 'Больше домов, еды и радости — больше людей.',
            reward: { gold: 50 },
        },
        {
            id: 'epoch',
            text: 'Перейдите в эпоху «Деревня»',
            hint: 'Нажмите «Новая эпоха», когда выполните условия.',
            reward: { gold: 100, stone: 50 },
        },
    ];

export function buildingName(def: BuildingDef, epoch: number): string {
    let name = def.name;

    for (const [from, later] of def.names ?? []) {
        if (epoch >= from) {
            name = later;
        }
    }

    return name;
}

export function epochYearEnd(epoch: number): number {
    return EPOCHS[epoch + 1]?.year ?? 2999;
}
