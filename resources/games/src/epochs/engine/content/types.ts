/**
 * The shape of the game's content files (resources/games/content/epochs).
 * Everything the game is made of — map, biomes, climate, eras, resources,
 * technologies, buildings with their levels, blueprints, goals, NPCs and
 * sounds — is data described by these types; the engine only interprets it.
 */

export type ResourceId = string;
export type Amounts = Record<ResourceId, number>;

export interface WorldFile {
    map: {
        width: number;
        height: number;
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
        buildings: {
            type: string;
            level?: number;
            at: 'center' | [number, number];
        }[];
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
        /** An upgrade without its own `upgrade` cost costs this share of the level's `cost`. */
        upgradeShare: number;
        moveCostPerTile: number;
        clearFeature: Record<string, { cost: Amounts; gain: Amounts }>;
    };
    districts: {
        /** Tiles around a district hall that belong to its district. */
        radius: number;
        policies: DistrictPolicyDef[];
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

export interface DistrictPolicyDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    effects: {
        /** Percent to the output of buildings in the district; "*" means every resource. */
        produces?: Record<ResourceId | '*', number>;
        /** Added to the happiness of homes in the district. */
        happiness?: number;
        /** Percent to the housing of homes in the district. */
        housing?: number;
        /** Percent to the pollution made in the district (negative = cleaner). */
        pollution?: number;
        /**
         * Gold per second for every building in the district, times how many
         * eras older its level is than the current era (old houses draw tourists).
         */
        tourism?: number;
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
    /** The era it is discovered in; the HUD hides it before that. */
    epoch: string;
    capped: boolean;
    description: string;
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

export type RoadStyle =
    'dirt' | 'cobble' | 'paved' | 'asphalt' | 'smart' | 'glow';

/**
 * The materials of an era's architecture. A building level is drawn with
 * the palette of the era it belongs to — a straw hut keeps its straw in
 * the year 3000 — and a blueprint or the player's colours override keys.
 */
export interface Palette {
    wall: string;
    /** Wall colours picked per building for variety ("walls" in a model). */
    walls: string[];
    roof: string;
    trim: string;
    window: string;
    /** Lit windows at night. */
    lit: string;
    glass: string;
    metal: string;
    road: string;
    roadEdge: string;
    roadMark: string | null;
    roadStyle: RoadStyle;
    plaza: string;
    crop: string;
    flag: string;
    accent: string;
    /** Sky gradient while this era is the current one: zenith, horizon. */
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
        techs: string[];
        cost: Amounts;
    } | null;
}

/** Bonuses a researched technology gives the whole city, in percent unless noted. */
export interface TechBonus {
    /** Percent to the output of a resource; "*" means every resource. */
    produces?: Record<ResourceId | '*', number>;
    /** Points added to every home's happiness. */
    happiness?: number;
    housing?: number;
    storage?: number;
    /** Percent shorter construction. */
    buildSpeed?: number;
    tax?: number;
    /** Percent shorter research. */
    research?: number;
}

export interface TechDef {
    id: string;
    name: string;
    icon: string;
    /** The era it can be researched from. */
    epoch: string;
    description: string;
    cost: Amounts;
    /** Game seconds the research takes. */
    time: number;
    requires: string[];
    bonus: TechBonus | null;
}

export type RoofShape =
    | 'gable'
    | 'hip'
    | 'pyramid'
    | 'flat'
    | 'dome'
    | 'cone'
    | 'shed'
    | 'sawtooth'
    | 'mansard';

export type PaletteKey =
    'wall' | 'roof' | 'trim' | 'window' | 'glass' | 'metal' | 'accent';

/**
 * A style the Architects' Bureau can unlock: it recolours (and may change
 * the roof of) the buildings it applies to, whatever their level.
 */
export interface BlueprintDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    epoch: string;
    /** The Bureau level needed to unlock it. */
    tier: number;
    cost: Amounts;
    /** Building ids it fits; empty means every ordinary building. */
    buildings: string[];
    colors: Partial<Record<PaletteKey, string>>;
    roof: RoofShape | null;
}

export type GoalCondition =
    | { type: 'population'; value: number }
    | { type: 'building'; building: string; count: number; level?: number }
    | { type: 'epoch'; epoch: string }
    | { type: 'tech'; tech: string }
    | { type: 'techs'; count: number }
    | { type: 'resource'; resource: ResourceId; value: number }
    | { type: 'happiness'; value: number }
    | { type: 'districts'; count: number }
    | { type: 'blueprints'; count: number }
    /** Buildings standing at a level at least `age` eras older than now. */
    | { type: 'heritage'; count: number; age: number };

/** A goal — shown as a task while open, kept as an achievement once done. */
export interface GoalDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    /** Shown from this era on. */
    epoch: string;
    condition: GoalCondition;
    reward: Amounts;
}

/** How a part looks: plain, see-through glass, shiny metal, or glowing. */
export type Material = 'matte' | 'glass' | 'metal' | 'glow';

/** A side of a box: n = towards y−, s = towards y+, w = x−, e = x+. */
export type Face = 'n' | 'e' | 's' | 'w';

/** The outline of a tower, crown or prism, fitted into its w × d box. */
export type PlanShape =
    'rect' | 'rounded' | 'chamfer' | 'ellipse' | 'octagon' | 'tri' | 'cross';

/**
 * How the walls of a storey are drawn: punched windows (grid), a glass
 * curtain wall, ribbon windows, vertical fins, Art Deco piers, brick with
 * sills and lintels, stone with arched windows, prefab panels, or timber
 * framing.
 */
export type FacadeStyle =
    | 'grid'
    | 'glass'
    | 'ribbon'
    | 'fins'
    | 'deco'
    | 'brick'
    | 'stone'
    | 'panel'
    | 'timber';

/** What tops a tower: a frame of fins, steps, a spike, or a lit halo. */
export type CrownStyle = 'fins' | 'stepped' | 'spike' | 'halo';

/**
 * One piece of a building's 3D model. x, y, w, d are in tiles from the
 * building's corner (x east, y south); z and h are in tiles upward.
 * Colours are palette keys (see Palette; "walls" picks a wall variant per
 * building) or "#hex" values.
 */
export type ModelPart =
    | {
          kind: 'box';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          color: string;
          material?: Material;
      }
    | {
          kind: 'roof';
          shape: RoofShape;
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          color: string;
          /** Ridge direction of gable / shed / sawtooth roofs. */
          axis?: 'x' | 'y';
          /** How far the roof sticks out past the walls, in tiles. */
          overhang?: number;
          material?: Material;
      }
    | {
          /** A stack of storeys with a grid of windows on every side. */
          kind: 'floors';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          floors: number;
          floorHeight: number;
          color: string;
          window: string;
          /** A slab line between storeys. */
          band?: string;
          material?: Material;
          /** How the walls are drawn; grid (punched windows) by default. */
          facade?: FacadeStyle;
          /** A projecting moulding along the top. */
          cornice?: string;
          /** A darker base storey band. */
          plinth?: string;
      }
    | {
          kind: 'windows';
          faces: Face[];
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          rows: number;
          cols: number;
          color: string;
      }
    | {
          kind: 'door';
          face: Face;
          /** The wall it is in, as the box of that wall. */
          x: number;
          y: number;
          w: number;
          d: number;
          width: number;
          height: number;
          color: string;
      }
    | {
          /** Timber framing on the walls of a box. */
          kind: 'beams';
          faces: Face[];
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
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
          z: number;
          r: number;
          h: number;
          color: string;
          /** Top radius as a share of r (1 = straight, 0 = cone). */
          taper?: number;
          segments?: number;
          material?: Material;
      }
    | {
          kind: 'sphere';
          x: number;
          y: number;
          z: number;
          r: number;
          color: string;
          /** Only the upper half — a dome. */
          half?: boolean;
          material?: Material;
      }
    | {
          kind: 'torus';
          x: number;
          y: number;
          z: number;
          r: number;
          tube: number;
          color: string;
          /** Turns per second around the vertical axis. */
          spin?: number;
          material?: Material;
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
          type: 'smoke' | 'steam' | 'dust' | 'water' | 'sparks';
      }
    | {
          kind: 'light';
          x: number;
          y: number;
          z: number;
          radius: number;
          color: string;
      }
    | {
          kind: 'tree';
          x: number;
          y: number;
          scale: number;
          conifer: boolean;
          /** Height it stands on (a roof garden); the ground by default. */
          z?: number;
      }
    | {
          /**
           * A tower of storeys on any plan, narrowing (taper: top width as a
           * share of the base) and turning (twist, degrees) as it rises.
           */
          kind: 'tower';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          plan: PlanShape;
          /** Corner radius (rounded) or cut (chamfer) or arm width (cross). */
          r?: number;
          floors: number;
          floorHeight: number;
          taper?: number;
          twist?: number;
          facade?: FacadeStyle;
          color: string;
          window: string;
          /** Mullions, fins, slabs and piers. */
          trim?: string;
          /** The flat top. */
          cap?: string;
          material?: Material;
      }
    | {
          /** A plain prism on any plan: podiums, drums, plinths. */
          kind: 'prism';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          plan: PlanShape;
          r?: number;
          color: string;
          /** Top width as a share of the base. */
          taper?: number;
          material?: Material;
      }
    | {
          kind: 'crown';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          plan?: PlanShape;
          r?: number;
          style: CrownStyle;
          color: string;
          /** Light that comes on at night (halo, fin tips). */
          glow?: string;
      }
    | {
          /** Free-standing columns in front of a wall, optionally under a pediment. */
          kind: 'columns';
          face: Face;
          /** The wall, as its box. */
          x: number;
          y: number;
          w: number;
          d: number;
          z?: number;
          h: number;
          count: number;
          /** How far in front of the wall they stand. */
          depth?: number;
          color: string;
          /** A triangular gable over the colonnade, in this colour. */
          pediment?: string | null;
      }
    | {
          /** A row of round-topped openings (arcade) on walls. */
          kind: 'arches';
          faces: Face[];
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          count: number;
          color: string;
          /** The openings; lit at night. */
          opening?: string;
      }
    | {
          kind: 'balconies';
          faces: Face[];
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          floors: number;
          floorHeight: number;
          depth?: number;
          color: string;
          rail?: string;
          /** Glass railings instead of solid parapets. */
          glass?: boolean;
      }
    | {
          /** Flat columns on walls, with a base and a capital. */
          kind: 'pilasters';
          faces: Face[];
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          count: number;
          color: string;
      }
    | {
          /** A projecting moulding around the top of a box. */
          kind: 'cornice';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h?: number;
          out?: number;
          color: string;
      }
    | {
          /** Battlements: a parapet with merlons around a roof. */
          kind: 'crenels';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          color: string;
      }
    | {
          /** Small gabled windows on one slope of a roof. */
          kind: 'dormers';
          face: Face;
          /** The roof's footprint and the height its slope starts at. */
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          count: number;
          h: number;
          color: string;
          roof: string;
          window?: string;
      }
    | {
          /** A sloping canopy over a wall, striped if `stripe` is set. */
          kind: 'awning';
          face: Face;
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          depth: number;
          color: string;
          stripe?: string;
      }
    | {
          /** Steps up to a wall, centred on it. */
          kind: 'stairs';
          face: Face;
          x: number;
          y: number;
          w: number;
          d: number;
          width: number;
          steps: number;
          height: number;
          color: string;
      }
    | {
          /** Posts and rails (or a low wall) around a plot. */
          kind: 'fence';
          x: number;
          y: number;
          w: number;
          d: number;
          h: number;
          color: string;
          /** A gap for a gate in this side. */
          gate?: Face;
          solid?: boolean;
      }
    | {
          /** Rows of tilted panels facing south. */
          kind: 'solar';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          rows: number;
          color?: string;
      }
    | {
          kind: 'chimney';
          x: number;
          y: number;
          z: number;
          w: number;
          h: number;
          color: string;
          smoke?: boolean;
      }
    | {
          /** A landing pad with an H and edge lights, centred on x, y. */
          kind: 'helipad';
          x: number;
          y: number;
          z: number;
          r: number;
      }
    | {
          /**
           * Light lines on the edges of a box — corners and rings — dim by
           * day, glowing at night.
           */
          kind: 'neon';
          x: number;
          y: number;
          z: number;
          w: number;
          d: number;
          h: number;
          color: string;
          rings?: number;
          corners?: boolean;
      }
    | {
          /** A clock face on a wall, lit at night. */
          kind: 'clock';
          face: Face;
          x: number;
          y: number;
          w: number;
          d: number;
          z: number;
          r: number;
          color?: string;
      }
    | {
          kind: 'blades';
          x: number;
          y: number;
          z: number;
          r: number;
          /** Turns per second. */
          speed: number;
          color: string;
          /** The axis the blades turn around (the way the hub faces). */
          axis?: 'x' | 'y' | 'z';
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
    /** What this level is called (Hut, Log house, …, Skyscraper). */
    name: string;
    /** The era it can be built or upgraded to in; also its architecture. */
    epoch: string;
    /** A technology it needs, if any. */
    tech?: string;
    description?: string;
    /** Price to build it straight away. */
    cost: Amounts;
    /** Price to upgrade the level below to it; defaults to a share of `cost`. */
    upgrade?: Amounts;
    buildTime: number;
    effects: Effects;
    model: {
        parts: ModelPart[];
        /**
         * The skyscraper-studio design the parts were made from, kept so
         * the Workshop can open it again; the game draws `parts` only.
         */
        studio?: unknown;
    };
}

export type Category =
    | 'housing'
    | 'food'
    | 'resources'
    | 'industry'
    | 'power'
    | 'trade'
    | 'services'
    | 'science'
    | 'infrastructure';

export interface BuildingDef {
    id: string;
    name: string;
    icon: string;
    category: Category;
    description: string;
    size: { w: number; h: number };
    unique: boolean;
    /** Not in the build menu (the town centre). */
    hidden: boolean;
    /** Special roles the engine knows about. */
    role?: 'road' | 'center' | 'district' | 'bureau';
    placement: {
        requiresRoad: boolean;
        biomes?: string[];
        nearWater?: number;
        /** May also stand on open water (a road there becomes a bridge). */
        overWater?: boolean;
    };
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
    vehicle?: 'cart' | 'car' | 'bus' | 'hover' | 'drone';
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
    techs: { techs: TechDef[] };
    blueprints: { blueprints: BlueprintDef[] };
    goals: { goals: GoalDef[] };
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
    'techs',
    'blueprints',
    'goals',
    'npcs',
    'sounds',
] as const;

export type ContentFile = (typeof CONTENT_FILES)[number];
