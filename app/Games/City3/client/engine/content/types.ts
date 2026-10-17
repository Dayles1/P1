/**
 * The shape of the game's content files (app/Games/City3/content).
 * Everything the game is made of — map, biomes, climate, eras, resources,
 * technologies, buildings with their levels, blueprints, goals, NPCs and
 * sounds — is data described by these types; the engine only interprets it.
 */

export type ResourceId = string;
export type Amounts = Record<ResourceId, number>;

/** Tax policy of the Town Hall (gdd §4.11). */
export type TaxPolicy = 'low' | 'normal' | 'high';

/** An era's haze: horizon and light tint and fog distance (blended in over the transition). */
export interface Atmosphere {
    tint: string;
    /** How strongly the tint colours the sky and light, 0..0.3. */
    strength: number;
    /** Fog distance multiplier. */
    fog: number;
}

export interface WorldFile {
    /**
     * The one map everyone plays on. From north (row 0, where the mountain
     * range outside the map begins) to south: land, beach, shallow sea.
     */
    map: {
        width: number;
        landRows: number;
        beachRows: number;
        seaRows: number;
        /** The biome of each band. */
        biomes: { land: string; beach: string; sea: string };
        /** The columns open from the start, over the land and the beach. */
        start: { minX: number; maxX: number };
    };
    time: {
        /** Game seconds in a year: one rate for the whole game, from year 0. */
        secondsPerYear: number;
        /** Day and night and the seasons run on their own clock. */
        secondsPerDay: number;
        /** The time of day the world starts at (0.3 ≈ morning). */
        dayStart?: number;
        daysPerSeason: number;
        tickSeconds: number;
    };
    start: {
        epoch: string;
        population: number;
        resources: Amounts;
        buildings: {
            type: string;
            level?: number;
            /** 'center' = the middle of the land rows. */
            at: 'center' | [number, number];
        }[];
    };
    /** Money, per year: the engine applies `value / secondsPerYear` each game second. */
    economy: {
        /** The one currency's resource id. */
        currency: ResourceId;
        /** Tax per citizen per year, before happiness and bonuses. */
        taxPerCitizen: number;
        /** Tax multiplier by the era (index) of each home's current level. */
        taxMultByLevelEra: number[];
        /** Share of the citizens who work. */
        workforceShare: number;
        /** Food each citizen eats per year. */
        foodPerCitizen: number;
        /** Storage of food, materials and goods without any storehouse. */
        storageBase: number;
        /** Money per unit; `matImport` buys the materials a construction lacks. */
        prices: {
            foodImport: number;
            foodExport: number;
            matImport: number;
            matExport: number;
            goodsExport: number;
            fuelImport: number;
            fuelExport: number;
            gridPower: number;
        };
        /** An upgrade credits this share of the current level's money price… */
        tradeIn: number;
        /** …but costs at least this share of the new level. */
        upgradeFloor: number;
        /** Share of the current level's money price a demolition returns. */
        refundShare: number;
        /** Moving costs this share of the current level's money price. */
        moveShare: number;
        /** Food and materials above this share of the storage cap are exported. */
        exportAbove: number;
        /** Unemployment `u` cuts the tax by `share × u`. */
        unemploymentTaxLoss: number;
        /** Power users run at `base + share × power ratio` when the grid cannot be bought. */
        powerShortfall: { base: number; share: number };
        /** Metro fares per covered citizen: this share of the tax per citizen × taxMult. */
        faresShareOfTax: number;
        /**
         * Tourism demand per attraction point, by the era (index) of the
         * attraction's own level; Heritage doubles it (ramped in) once the
         * level is `heritageEraGap` eras older than the city.
         */
        tourism: {
            perPoint: number;
            eraMult: number[];
            heritageMult: number;
            heritageEraGap: number;
            heritageRampYears: number;
            beachManorMult: number;
        };
        /** Town Hall policies (gdd §4.11); each change is locked for `lockYears`. */
        policies: {
            lockYears: number;
            tax: {
                /** The era the tax policy opens in. */
                epoch: string;
                options: Record<
                    TaxPolicy,
                    { name: string; tax: number; happiness: number }
                >;
            };
            /** «Плотная застройка»: housing and car trips up (shares), happiness down. */
            dense: {
                name: string;
                epoch: string;
                housing: number;
                happiness: number;
                trips: number;
            };
        };
        /** Safety nets (gdd §4.10, §4.12). */
        treasury: {
            /** Buildings mothballed per year while the treasury is empty and the year ran at a loss. */
            mothballPerYear: number;
            loan: {
                maxYearsOfGross: number;
                ratePerYear: number;
                /** Share of a positive net that repays the loan. */
                repayShareOfNet: number;
            };
            chest: {
                maxYearsOfNet: number;
                /** Real hours away that fill the chest. */
                fillRealHours: number;
                /** Game years between two chests. */
                cooldownYears: number;
            };
        };
    };
    /** The race against history (gdd §2.3, §2.4, §10). */
    chronicle: {
        /** Share of the way to the next era while the Town Hall builds, and for a complete gate. */
        lead: { building: number; progress: number; fallingYears: number };
        /** On era entry: +perStar × stars to taxes, exports and production for `years`, ramped over `rampYears`. */
        golden: {
            perStar: number;
            years: number;
            rampYears: number;
            happiness: number;
        };
        /** Spirit of the Age: the Town Hall upgrade and discoveries get cheaper once history is ahead. */
        spirit: { perYear: number; cap: number };
        /** Years the sky, the accent, clothes and vehicles take to follow a new era. */
        transitionYears: number;
        score: {
            eraBase: number;
            /** Points for 0, 1, 2 and 3 stars. */
            starPoints: [number, number, number, number];
            cityPerSqrtPeak: number;
            happinessBase: number;
            happinessShare: number;
            /** Years of the moving average of happiness. */
            happinessYears: number;
            stripWidth: number;
            perStrip: number;
            perAchievement: number;
        };
    };
    /** A home's happiness: base, + comfort × services covered, + auras, − pollution. */
    happiness: {
        base: number;
        comfort: number;
        auraCap: number;
        pollutionCap: number;
        /** Metro stations' appeal near a home is capped at this. */
        transitCap: number;
        starving: number;
        noPower: number;
    };
    /** Per game second (gdd §4.7). */
    population: {
        /** Share of the gap to P* that moves in, times min(1, happiness / 70)… */
        growthRate: number;
        /** …plus this many. */
        growthFlat: number;
        /** Share of the people above P* who move out. */
        moveOutShare: number;
        /** Share of the people who leave while starving. */
        starvingDecline: number;
        /** Homes are empty at happiness `from` and full at `from + span`. */
        occupancy: { from: number; span: number };
        /** A home holds [base + share × services covered] of its places. */
        comfortFill: [number, number];
        /** Free climb progress a modernising home gains per year (gdd §4.7). */
        organicPerYear: number;
        /** The need ladder: a home level of tier T needs the first T of these. */
        needs: NeedDef[];
    };
    /**
     * Aggregate traffic until the spatial model (slice 6): trips per
     * citizen and per job, their length in tiles and the hotspot factor;
     * ρ = trips × length × hotspot / road capacity. Telemetry only.
     */
    traffic: {
        tripsPerCitizen: number;
        tripsPerJob: number;
        tripLength: number;
        hotspot: number;
    };
    districts: {
        /** Tiles around a district hall that belong to its district. */
        radius: number;
    };
    npc: {
        residentsPerNpc: number;
        maxNpcs: number;
        trafficPerRoads: number;
        maxTraffic: number;
    };
    events: {
        firstYear: number;
        everyYears: [number, number];
        list: GameEventDef[];
    };
}

/**
 * One rung of the home need ladder (gdd §4.7): a service reaching the
 * home, happiness or an aura of at least `min` at it, a power ratio of at
 * least `min`, or transit.
 */
export interface NeedDef {
    need: ServiceId | 'happiness' | 'aura' | 'power' | 'transit';
    min?: number;
    /** What the build button names when it is missing («Образование»). */
    label: string;
}

export interface GameEventDef {
    id: string;
    weight: number;
    text: string;
    /**
     * Values below 1 are a share — of the store's capacity for a stock, of
     * the treasury for money — otherwise an amount.
     */
    gain?: Amounts;
    lose?: Amounts;
    mood?: { amount: number; years: number };
    epochs?: string[];
}

/** currency = money (the one currency); stock = kept in the stores; flow = used as made (fuel). */
export type ResourceKind = 'currency' | 'stock' | 'flow';

export interface ResourceDef {
    id: ResourceId;
    kind: ResourceKind;
    name: string;
    icon: string;
    /** The era it is discovered in; the interface hides it before that. */
    epoch: string;
    /** What it is called in each era (materials: wood and stone → … → composites). */
    faces?: Record<string, string>;
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
}

export interface BiomesFile {
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
    [key: string]: unknown;
}

/** How the one currency looks in an era: the amount never changes, only its face. */
export interface CurrencyFace {
    /** On the era card: «Серебряные гроши». */
    name: string;
    /** In tooltips and for screen readers: «Гроши». */
    short: string;
    /** The text fallback of the icon: ₰. */
    symbol: string;
    /** The drawn icon's id. */
    icon: string;
    flavor: string;
}

/** The new thing to do in an era (gdd §1.3). */
export type EraVerb =
    'build' | 'charters' | 'orders' | 'rail' | 'metro' | 'routes' | 'programs';

/** A building the gate into an era asks for. */
export interface EntryItem {
    type: string;
    level: number;
    count: number;
    label: string;
    /** District halls: with a charter. */
    charter?: boolean;
    /** Port: this many delivered trade orders. */
    ordersDelivered?: number;
    /** Station: on a line to a mountain portal. */
    connectedToPortal?: boolean;
    /** Metro stations: on one line. */
    sameLine?: boolean;
    /** Airport: this many open flight routes. */
    routes?: number;
}

/** What it takes to enter an era: the Town Hall upgrade is the entry. */
export interface EpochEntry {
    townHallLevel: number;
    population: number;
    /** How many of the previous era's discoveries. */
    discoveries: number;
    /** Calendar years for ★★ and ★★★ (★ = by the era's own year). */
    stars: [number, number];
    items: EntryItem[];
}

export interface EpochDef {
    id: string;
    year: number;
    name: string;
    tagline: string;
    currency: CurrencyFace;
    verb: EraVerb;
    /** Absent for the first era. */
    entry?: EpochEntry;
    /** The interface accent colour. */
    accent: string;
    atmosphere: Atmosphere;
    palette: Palette;
    ambience: string;
}

/** Bonuses a discovery gives the whole city, in percent unless noted. */
export interface TechBonus {
    /** Percent to the output of a resource; "*" means every resource. */
    produces?: Record<ResourceId | '*', number>;
    /** Points added to every home's happiness. */
    happiness?: number;
    housing?: number;
    tax?: number;
    /** Percent to trade capacity. */
    trade?: number;
    /** Percent faster research. */
    research?: number;
    /** Percent to traffic loads (negative = lighter). */
    traffic?: number;
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

export type ServiceId = 'water' | 'health' | 'education' | 'leisure' | 'data';

export type GoalCondition =
    | { type: 'population'; value: number }
    /** Complete buildings of a type (or any of several types), at a level or higher. */
    | {
          type: 'building';
          building: string | string[];
          count: number;
          level?: number;
      }
    | { type: 'epoch'; epoch: string }
    | { type: 'tech'; tech: string }
    | { type: 'techs'; count: number }
    | { type: 'happiness'; value: number }
    /** Share of the home tiles a service covers, once homes cover `minTiles`. */
    | { type: 'coverage'; service: ServiceId; share: number; minTiles: number }
    /** The city's own power supply. */
    | { type: 'power'; value: number }
    /** Buildings standing at a level at least `age` eras older than now. */
    | { type: 'heritage'; count: number; age?: number }
    // Conditions of later systems: kept in the data, not checked yet.
    | { type: 'buildingLevel'; building: string; level: number; count: number }
    | { type: 'stars'; perEra?: number; total?: number }
    | { type: 'strips'; count: number }
    | { type: 'peakPopulation'; value: number }
    | { type: 'trafficBelow'; value: number; population: number }
    | { type: 'pollutionBelow'; value: number; population: number }
    | { type: 'noImportsYears'; years: number; epoch: string }
    | { type: 'happinessYears'; value: number; years: number }
    | { type: 'calendarYear'; value: number }
    | { type: 'neverArrears' };

/** A story goal: one task at a time from its era, rewarded in money. */
export interface GoalDef {
    id: string;
    /** Shown from this era on. */
    epoch: string;
    name: string;
    icon: string;
    description: string;
    condition: GoalCondition;
    reward: Amounts;
}

/** A side task made from the city's state; its reward is years of gross income. */
export interface SideTemplateDef {
    id: string;
    condition: GoalCondition;
    rewardYearsOfGross: number;
}

export interface AchievementDef {
    id: string;
    name: string;
    description: string;
    condition: GoalCondition;
}

export interface GoalsFile {
    story: GoalDef[];
    sideTemplates: SideTemplateDef[];
    achievements: AchievementDef[];
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

/**
 * What a building level does. Every rate is per game year (`produces`,
 * `consumes`, `trade`, `visitors`); power, storage, radii and percents are
 * levels, not rates.
 */
export interface Effects {
    housing: number;
    jobs: number;
    produces: Amounts;
    consumes: Amounts;
    /** Trade capacity per year. */
    trade: number;
    storage: number;
    power: number;
    powerUse: number;
    aura: { radius: number; happiness: number } | null;
    pollution: { radius: number; amount: number } | null;
    coverage: { service: ServiceId; radius: number } | null;
    attraction: number;
    /** Visitor capacity per year. */
    visitors: number;
    /** Percent faster research. */
    research: number;
    /** Percent off every import. */
    importDiscount: number;
    /** Percent onto the goods export price. */
    goodsPremium: number;
    transit: { radius: number; share: number; happiness: number } | null;
    charterRadius: number;
    dataTax: { radius: number; percent: number } | null;
    boost: { targets: string[]; radius: number; percent: number } | null;
}

/** Where a building may stand (gdd §5.1). */
export type Zone =
    'land' | 'landOrBeach' | 'mountain' | 'coast' | 'road' | 'airportPlot';

export type DepositKind = 'ore' | 'coal' | 'oil';

/** Labour priority class: services, food, raw materials, industry, commerce. */
export type JobClass = 'svc' | 'food' | 'raw' | 'ind' | 'com';

export interface LevelDef {
    level: number;
    /** What this level is called (Hut, Log house, …, Skyscraper). */
    name: string;
    /** The era it can be built or upgraded to in; also its architecture. */
    epoch: string;
    /** A discovery it needs, if any. */
    tech?: string;
    description?: string;
    /** What else it needs: citizens, or a Town Hall level. */
    requires?: { population?: number; townHallLevel?: number };
    /** Price to build it straight away: money and construction materials. */
    cost: Amounts;
    /** Money per year. */
    upkeep: number;
    /** Game seconds. */
    buildTime: number;
    /** Homes: how many of the needs (water, leisure, …) it asks for. */
    tier: number;
    /** Streets: trips per tile, happiness next to it, transit share, cosmetic speed. */
    capacity?: number;
    appeal?: number;
    transit?: number;
    speed?: number;
    effects: Effects;
    model: {
        parts: ModelPart[];
        /**
         * The skyscraper-studio design the parts were made from (City
         * Chronicle 2's Workshop); the game draws `parts` only.
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
    /** Up to 12 × 4 tiles. */
    size: { w: number; h: number };
    unique: boolean;
    /** Not in the build menu (the town centre). */
    hidden: boolean;
    /** Null for network pieces (streets), which employ nobody. */
    jobClass: JobClass | null;
    placement: {
        zone: Zone;
        /** A deposit spot it must stand on (mines, coal mines, oil wells). */
        deposit?: DepositKind;
        requiresRoad: boolean;
    };
    /** Counts as Heritage once its level is two eras old. */
    heritage: boolean;
    /** May be turned (stations). */
    rotatable: boolean;
    /** Tax multiplier of its homes (manors ×3). */
    taxMult: number;
    /** Line pieces: the network they belong to. */
    network: 'road' | 'rail' | null;
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

/** Everything, as client/content.ts bundles it. */
export interface ContentBundle {
    world: WorldFile;
    resources: { resources: ResourceDef[] };
    biomes: BiomesFile;
    climate: ClimateFile;
    epochs: { epochs: EpochDef[] };
    techs: { techs: TechDef[] };
    blueprints: { blueprints: BlueprintDef[] };
    goals: GoalsFile;
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
