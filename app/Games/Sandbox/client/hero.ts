/**
 * The hero: class, gender, level, experience, the free points put into
 * attributes and the artifacts absorbed — and everything worked out from
 * them (health, mana, stamina, defence, how hard and how fast blows
 * land, speed, the legendary skills…).
 *
 * The rules come from the server's config/heroes.php, handed to the page
 * as JSON (views/app.blade.php), so the server checks saves with the very
 * same numbers. App\Games\Sandbox\Heroes does the same sums in PHP.
 */

export type HeroClass = 'tank' | 'fighter' | 'assassin' | 'mage';
export type Gender = 'male' | 'female';
export type Attribute = 'strength' | 'agility' | 'spirit';
export type Attributes = Record<Attribute, number>;

export const HERO_CLASSES: HeroClass[] = [
    'tank',
    'fighter',
    'assassin',
    'mage',
];
export const GENDERS: Gender[] = ['male', 'female'];
export const ATTRIBUTES: Attribute[] = ['strength', 'agility', 'spirit'];

/** base + Σ attribute × factor, kept between min and max. */
export type Formula = Partial<
    Record<Attribute | 'base' | 'min' | 'max', number>
>;

export type FormulaName =
    | 'health'
    | 'mana'
    | 'stamina'
    | 'defense'
    | 'damage'
    | 'speed'
    | 'attack_speed'
    | 'crit'
    | 'crit_damage'
    | 'health_regen'
    | 'mana_regen'
    | 'stamina_regen'
    | 'spell'
    | 'knowledge';

export type XpReward =
    | 'deer'
    | 'boar'
    | 'wolf'
    | 'zombie'
    | 'tree'
    | 'rock'
    | 'dig'
    | 'craft'
    | 'research'
    | 'artifact'
    | 'absorb'
    | 'fuse';

export type ArtifactTier = 'common' | 'rare' | 'legendary';

/** What an absorbed artifact can add to besides attributes. */
export type BonusKey =
    | 'health'
    | 'mana'
    | 'speed'
    | 'jump'
    | 'swim'
    | 'breath'
    | 'gather'
    | 'light';

/** The skills legendary artifacts give. */
export type Passive =
    'double_jump' | 'water_breathing' | 'vampirism' | 'second_wind';

export interface ArtifactRules {
    tier: ArtifactTier;
    max: number;
    attributes?: Partial<Attributes>;
    bonus?: Partial<Record<BonusKey, number>>;
    skill?: Passive;
}

export interface SkillRules {
    name: 'guard' | 'whirlwind' | 'dash' | 'bolt';
    cost: number;
    cooldown: number;
    seconds?: number;
    damage_taken?: number;
    radius?: number;
    damage?: number;
    speed?: number;
    range?: number;
}

export interface HeroRules {
    attributes: Attribute[];
    classes: Record<HeroClass, Attributes>;
    genders: Record<Gender, Record<string, Partial<Attributes>>>;
    levels: {
        max: number;
        per_level: number;
        bonus_points: Record<string, number>;
        bonus_every: { from: number; step: number; points: number };
        xp: { base: number; power: number };
    };
    formulas: Record<FormulaName, Formula>;
    stamina_costs: { sprint: number; jump: number; blow: number };
    xp_rewards: Record<XpReward, number>;
    skills: Record<HeroClass, SkillRules>;
    mob_scaling: { health: number; damage: number };
    artifacts: Record<string, ArtifactRules>;
    essence: Record<ArtifactTier, number>;
    artifact_respawn_minutes: number;
    passives: {
        vampirism: number;
        second_wind: { health: number; cooldown: number };
    };
}

/** Read once from the page (see views/app.blade.php). */
export const RULES: HeroRules = JSON.parse(
    document.getElementById('sandbox-heroes')?.textContent || 'null',
);

export interface SavedHero {
    class: HeroClass;
    gender: Gender;
    level: number;
    xp: number;
    points: Partial<Attributes>;
    /** Artifact id → times absorbed. */
    absorbed?: Record<string, number>;
}

/** What absorbing an artifact gives, or undefined for anything else. */
export function artifactRules(item: string): ArtifactRules | undefined {
    return RULES.artifacts[item];
}

export function startingAttributes(
    heroClass: HeroClass,
    gender: Gender,
): Attributes {
    const base = RULES.classes[heroClass];
    const shifts = RULES.genders[gender];
    const shift = shifts[heroClass] ?? shifts.default ?? {};

    return {
        strength: base.strength + (shift.strength ?? 0),
        agility: base.agility + (shift.agility ?? 0),
        spirit: base.spirit + (shift.spirit ?? 0),
    };
}

/** Free points earned by reaching the level. */
export function bonusPointsUpTo(level: number): number {
    let points = 0;

    for (const [at, each] of Object.entries(RULES.levels.bonus_points)) {
        if (Number(at) <= level) {
            points += each;
        }
    }

    const { from, step, points: each } = RULES.levels.bonus_every;

    for (let at = from; at <= level; at += step) {
        points += each;
    }

    return points;
}

/** Free points the level itself gives (0 on most levels). */
export function bonusPointsAt(level: number): number {
    return bonusPointsUpTo(level) - bonusPointsUpTo(level - 1);
}

/** What it takes to go from the level to the next one. */
export function experienceToNext(level: number): number {
    const { base, power } = RULES.levels.xp;

    return Math.round(base * level ** power);
}

export function derive(name: FormulaName, attributes: Attributes): number {
    const terms = RULES.formulas[name];
    let value = terms.base ?? 0;

    for (const attribute of ATTRIBUTES) {
        value += (terms[attribute] ?? 0) * attributes[attribute];
    }

    if (terms.min !== undefined) {
        value = Math.max(terms.min, value);
    }

    if (terms.max !== undefined) {
        value = Math.min(terms.max, value);
    }

    return value;
}

/** Everything the attributes decide, for the game and the character tab. */
export interface Derived {
    health: number;
    mana: number;
    stamina: number;
    defense: number;
    damage: number;
    speed: number;
    attackSpeed: number;
    crit: number;
    critDamage: number;
    healthRegen: number;
    manaRegen: number;
    staminaRegen: number;
    spell: number;
    knowledge: number;
}

export function deriveAll(attributes: Attributes): Derived {
    return {
        health: Math.round(derive('health', attributes)),
        mana: Math.round(derive('mana', attributes)),
        stamina: Math.round(derive('stamina', attributes)),
        defense: Math.round(derive('defense', attributes) * 10) / 10,
        damage: derive('damage', attributes),
        speed: derive('speed', attributes),
        attackSpeed: derive('attack_speed', attributes),
        crit: derive('crit', attributes),
        critDamage: derive('crit_damage', attributes),
        healthRegen: derive('health_regen', attributes),
        manaRegen: derive('mana_regen', attributes),
        staminaRegen: derive('stamina_regen', attributes),
        spell: derive('spell', attributes),
        knowledge: derive('knowledge', attributes),
    };
}

export class Hero {
    level = 1;
    xp = 0;
    readonly points: Attributes = { strength: 0, agility: 0, spirit: 0 };
    /** Artifact id → times absorbed. */
    readonly absorbed: Record<string, number> = {};

    constructor(
        readonly heroClass: HeroClass,
        readonly gender: Gender,
    ) {}

    /** A saved hero, or null when there is none (or it makes no sense). */
    static read(saved: unknown): Hero | null {
        const source = saved as Partial<SavedHero> | null;

        if (
            !source ||
            !HERO_CLASSES.includes(source.class as HeroClass) ||
            !GENDERS.includes(source.gender as Gender)
        ) {
            return null;
        }

        const hero = new Hero(source.class!, source.gender!);
        hero.level = Math.min(
            RULES.levels.max,
            Math.max(1, Math.floor(Number(source.level) || 1)),
        );
        hero.xp = Math.max(0, Math.floor(Number(source.xp) || 0));
        let left = bonusPointsUpTo(hero.level);

        for (const attribute of ATTRIBUTES) {
            const put = Math.max(
                0,
                Math.floor(Number(source.points?.[attribute]) || 0),
            );
            hero.points[attribute] = Math.min(put, left);
            left -= hero.points[attribute];
        }

        for (const [artifact, times] of Object.entries(source.absorbed ?? {})) {
            const rules = artifactRules(artifact);
            const count = Math.floor(Number(times) || 0);

            if (rules && count > 0) {
                hero.absorbed[artifact] = Math.min(count, rules.max);
            }
        }

        return hero;
    }

    /**
     * Where each attribute comes from: the class (with the gender), the
     * levels, the free points and the absorbed artifacts.
     */
    get sources(): Record<
        Attribute,
        { start: number; levels: number; points: number; artifacts: number }
    > {
        const start = startingAttributes(this.heroClass, this.gender);
        const growth = RULES.levels.per_level * (this.level - 1);
        const entry = (attribute: Attribute) => ({
            start: start[attribute],
            levels: growth,
            points: this.points[attribute],
            artifacts: this.fromArtifacts(
                (rules) => rules.attributes?.[attribute],
            ),
        });

        return {
            strength: entry('strength'),
            agility: entry('agility'),
            spirit: entry('spirit'),
        };
    }

    get attributes(): Attributes {
        const sources = this.sources;
        const total = (attribute: Attribute) => {
            const { start, levels, points, artifacts } = sources[attribute];

            return start + levels + points + artifacts;
        };

        return {
            strength: total('strength'),
            agility: total('agility'),
            spirit: total('spirit'),
        };
    }

    get derived(): Derived {
        const derived = deriveAll(this.attributes);
        derived.health += this.bonus('health');
        derived.mana += this.bonus('mana');
        derived.speed *= 1 + this.bonus('speed');

        return derived;
    }

    /** What absorbed artifacts add to a bonus (0.1 = 10% more, or points). */
    bonus(key: BonusKey): number {
        return this.fromArtifacts((rules) => rules.bonus?.[key]);
    }

    /** Whether an absorbed legendary artifact gave this skill. */
    has(passive: Passive): boolean {
        return Object.keys(this.absorbed).some(
            (artifact) => artifactRules(artifact)?.skill === passive,
        );
    }

    /** How many more times the artifact can be absorbed. */
    absorbLeft(artifact: string): number {
        const rules = artifactRules(artifact);

        return rules ? rules.max - (this.absorbed[artifact] ?? 0) : 0;
    }

    /** Takes in an artifact for good; false when it cannot be (any more). */
    absorb(artifact: string): boolean {
        if (this.absorbLeft(artifact) <= 0) {
            return false;
        }

        this.absorbed[artifact] = (this.absorbed[artifact] ?? 0) + 1;

        return true;
    }

    private fromArtifacts(
        value: (rules: ArtifactRules) => number | undefined,
    ): number {
        let total = 0;

        for (const [artifact, times] of Object.entries(this.absorbed)) {
            const rules = artifactRules(artifact);

            if (rules) {
                total += (value(rules) ?? 0) * times;
            }
        }

        return total;
    }

    get maxed(): boolean {
        return this.level >= RULES.levels.max;
    }

    get toNext(): number {
        return experienceToNext(this.level);
    }

    /** Free points not put anywhere yet. */
    get freePoints(): number {
        return (
            bonusPointsUpTo(this.level) -
            this.points.strength -
            this.points.agility -
            this.points.spirit
        );
    }

    get skill(): SkillRules {
        return RULES.skills[this.heroClass];
    }

    /** Adds experience; answers the levels reached on the way (often none). */
    gain(amount: number): number[] {
        const reached: number[] = [];

        if (amount <= 0) {
            return reached;
        }

        this.xp += Math.round(amount);

        while (!this.maxed && this.xp >= this.toNext) {
            this.xp -= this.toNext;
            this.level++;
            reached.push(this.level);
        }

        return reached;
    }

    /** Puts a free point into an attribute; false when there is none. */
    spend(attribute: Attribute): boolean {
        if (this.freePoints <= 0) {
            return false;
        }

        this.points[attribute]++;

        return true;
    }

    toJSON(): SavedHero {
        return {
            class: this.heroClass,
            gender: this.gender,
            level: this.level,
            xp: this.xp,
            points: { ...this.points },
            absorbed: { ...this.absorbed },
        };
    }
}
