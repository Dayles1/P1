/**
 * The shape of the game's content files (resources/games/content/epochs).
 * Everything the game is made of — map, biomes, climate, eras, buildings,
 * NPCs, sounds — is data described by these types; the engine only
 * interprets it.
 */

export type ResourceId = string;
export type Amounts = Record<ResourceId, number>;

export interface WorldFile {
    map: {
        width: number;
        height: number;
        tileWidth: number;
        tileHeight: number;
        seed: number | null;
    };
    time: {
        secondsPerDay: number;
        daysPerSeason: number;
        tickSeconds: number;
        maxOfflineSeconds: number;
    };
    start: {
        epoch: string;
        population: number;
        resources: Amounts;
        buildings: { type: string; at: 'center' | [number, number] }[];
    };
    population: {
        foodPerPerson: number;
        workforceShare: number;
        growthRate: number;
        taxPerPerson: number;
        baseHappiness: number;
        starvingPenalty: number;
        noPowerPenalty: number;
        coldPenalty: number;
        /** Share of people who leave per second while starving / unhappy. */
        starvingDecline: number;
        unhappyDecline: number;
        /** Share of the overflow that leaves per second when homes are gone. */
        overcrowdingDecline: number;
    };
    economy: {
        storageBase: number;
        refundShare: number;
        moveCostPerTile: number;
        clearFeature: Record<string, { cost: Amounts; gain: Amounts }>;
    };
    npc: {
        residentsPerNpc: number;
        maxNpcs: number;
        trafficPerRoads: number;
        maxTraffic: number;
    };
    events: {
        firstAfter: number;
        every: [number, number];
        list: GameEventDef[];
    };
}

export interface GameEventDef {
    id: string;
    weight: number;
    text: string;
    /** Values below 1 are a share of the current stock, otherwise an amount. */
    gain?: Amounts;
    lose?: Amounts;
    mood?: { amount: number; seconds: number };
    seasons?: string[];
    epochs?: string[];
}

export interface ResourceDef {
    id: ResourceId;
    name: string;
    icon: string;
    capped: boolean;
}

export interface BiomeDef {
    id: string;
    name: string;
    colors: [string, string];
    buildable: boolean;
    walkable: boolean;
    fertility: number;
    speed: number;
    water?: boolean;
    when: {
        elevation?: [number, number];
        moisture?: [number, number];
        temperature?: [number, number];
    };
    /** Chance (0..1) of each feature on a tile of this biome. */
    features: Partial<Record<FeatureId, number>>;
}

export type FeatureId = 'tree' | 'rock' | 'reeds';

export interface BiomesFile {
    generator: {
        elevationScale: number;
        moistureScale: number;
        temperatureScale: number;
        octaves: number;
        edgeFalloff: number;
        lake: { count: number; radius: [number, number] };
        river: { count: number; width: number };
        clearRadius: number;
    };
    biomes: BiomeDef[];
}

export interface SeasonDef {
    id: string;
    name: string;
    icon: string;
    temperature: number;
    fertility: number;
    groundTint: string | null;
    snow: number;
    treeTint: string;
    weather: Record<string, number>;
}

export interface WeatherDef {
    id: string;
    name: string;
    icon: string;
    light: number;
    particles: { kind: 'rain' | 'snow' | 'fog'; density: number } | null;
    sound: string | null;
    fertility?: number;
}

export interface ClimateFile {
    seasons: SeasonDef[];
    weather: WeatherDef[];
    weatherMinutes: [number, number];
    dayNight: {
        nightBelow: number;
        keyframes: {
            at: number;
            name: string;
            light: number;
            tint: string | null;
        }[];
    };
}

export interface Palette {
    wall: string;
    walls: string[];
    roof: string;
    trim: string;
    window: string;
    lit: string;
    glass: string;
    metal: string;
    road: string;
    roadEdge: string;
    roadMark: string | null;
    roadStyle: 'dirt' | 'cobble' | 'paved' | 'asphalt' | 'glow';
    plaza: string;
    crop: string;
    flag: string;
    accent: string;
    sky: [string, string];
    [key: string]: unknown;
}

export interface EpochTheme {
    bg: string;
    solid: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    font: string;
    radius: number;
}

export interface EpochDef {
    id: string;
    year: number;
    name: string;
    tagline: string;
    yearsPerDay: number;
    territory: number;
    palette: Palette;
    theme: EpochTheme;
    ambience: string;
    next: {
        population: number;
        buildings: { type: string; count: number; level?: number }[];
        cost: Amounts;
    } | null;
}

export type ModelPart =
    | {
          kind: 'box';
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          h: number;
          color: string;
      }
    | {
          kind: 'roof';
          shape: 'gable' | 'pyramid' | 'flat' | 'dome' | 'cone' | 'sawtooth';
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          h: number;
          color: string;
          axis?: 'x' | 'y';
      }
    | {
          kind: 'windows';
          face: 'left' | 'right';
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          h: number;
          rows: number;
          cols: number;
          color: string;
      }
    | {
          kind: 'door';
          face: 'left' | 'right';
          x: number;
          y: number;
          w: number;
          d: number;
          width: number;
          height: number;
          color: string;
      }
    | {
          kind: 'beams';
          face: 'left' | 'right';
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          h: number;
          count: number;
          color: string;
      }
    | {
          kind: 'ground';
          x: number;
          y: number;
          w: number;
          d: number;
          color: string;
      }
    | {
          kind: 'field';
          x: number;
          y: number;
          w: number;
          d: number;
          rows: number;
          color: string;
      }
    | {
          kind: 'cylinder';
          x: number;
          y: number;
          r: number;
          z: number;
          h: number;
          color: string;
          taper: number;
      }
    | {
          kind: 'flag';
          x: number;
          y: number;
          z: number;
          h: number;
          color: string;
      }
    | {
          kind: 'pole';
          x: number;
          y: number;
          z: number;
          h: number;
          color: string;
          blink: string | null;
      }
    | {
          kind: 'emitter';
          x: number;
          y: number;
          z: number;
          type: 'smoke' | 'steam' | 'dust' | 'water';
      }
    | {
          kind: 'light';
          x: number;
          y: number;
          z: number;
          radius: number;
          color: string;
      }
    | { kind: 'tree'; x: number; y: number; scale: number; conifer: boolean }
    | {
          kind: 'blades';
          x: number;
          y: number;
          z: number;
          r: number;
          speed: number;
          color: string;
      };

export type PartKind = ModelPart['kind'];

export interface Effects {
    housing: number;
    jobs: number;
    produces: Amounts;
    consumes: Amounts;
    storage: number;
    power: number;
    powerUse: number;
    aura: { radius: number; happiness: number } | null;
    pollution: { radius: number; amount: number } | null;
    boost: { targets: string[]; radius: number; percent: number } | null;
    near: {
        feature: FeatureId;
        radius: number;
        perTile: number;
        max: number;
    } | null;
    seasonal: boolean;
    defense: number;
}

export interface LevelDef {
    level: number;
    cost: Amounts;
    buildTime: number;
    requiresEpoch?: string;
    effects: Effects;
    model: { parts: ModelPart[] };
}

export type Category =
    | 'housing'
    | 'food'
    | 'resources'
    | 'industry'
    | 'trade'
    | 'civic'
    | 'infrastructure';

export interface BuildingDef {
    id: string;
    name: string;
    names: Record<string, string>;
    icon: string;
    category: Category;
    description: string;
    epoch: string;
    size: { w: number; h: number };
    unique: boolean;
    hidden: boolean;
    autoLevelByEpoch?: boolean;
    render?: 'road';
    placement: { requiresRoad: boolean; biomes?: string[]; nearWater?: number };
    costByEpoch?: Record<string, Amounts>;
    sounds: {
        place: string | null;
        upgrade: string | null;
        demolish: string | null;
        select: string | null;
        ambient: string | null;
    };
    levels: LevelDef[];
}

export interface NpcTypeDef {
    id: string;
    name: string;
    role: 'resident' | 'traffic';
    epochs: string[];
    speed: number;
    body: string[];
    skin?: string[];
    hat?: string | null;
    glow?: string | null;
    vehicle?: 'cart' | 'car' | 'hover';
}

export interface NpcsFile {
    schedule: {
        wake: number;
        work: number;
        leisure: number;
        home: number;
        jitter: number;
    };
    types: NpcTypeDef[];
    names: { first: string[]; last: string[] };
    age: [number, number];
    thoughts: Record<string, string>;
}

export interface SoundPreset {
    file: string | null;
    synth: {
        wave?: OscillatorType;
        notes?: number[];
        noise?: boolean;
        filter?: number;
        duration: number;
        volume: number;
        repeat?: number;
        gap?: number;
        harmonics?: number[];
    };
}

export interface SoundsFile {
    master: number;
    presets: Record<string, SoundPreset>;
    ambience: Record<
        string,
        { day: string[]; night: string[]; every: [number, number] }
    >;
}

/** Everything, as GET /api/games/epochs/content returns it. */
export interface ContentBundle {
    world: WorldFile;
    resources: { resources: ResourceDef[] };
    biomes: BiomesFile;
    climate: ClimateFile;
    epochs: { epochs: EpochDef[] };
    npcs: NpcsFile;
    sounds: SoundsFile;
    buildings: Record<string, BuildingDef>;
}

export const CONTENT_FILES = [
    'world',
    'resources',
    'biomes',
    'climate',
    'epochs',
    'npcs',
    'sounds',
] as const;

export type ContentFile = (typeof CONTENT_FILES)[number];
