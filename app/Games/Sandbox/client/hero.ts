/**
 * The hero: class, gender, look, level, experience, the free points put
 * into attributes, the artifacts found (the store) and the ones put into
 * the lineage tree — and everything worked out from them (health, mana,
 * stamina, defence, how hard and how fast blows land, speed, the skills
 * artifacts give…).
 *
 * The rules come from the server's config/heroes.php, handed to the page
 * as JSON (views/app.blade.php), so the server checks saves with the very
 * same numbers. App\Games\Sandbox\Heroes does the same sums in PHP.
 */

import { readAppearance } from './player/looks';
import type { Appearance } from './player/looks';

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
    | 'merge';

export type ArtifactType = 'stats' | 'skill';

export const ARTIFACT_TYPES: ArtifactType[] = ['stats', 'skill'];

/** The skills artifacts give, each with ranks 1 to 9. */
export type Passive =
    | 'vampirism'
    | 'second_wind'
    | 'double_jump'
    | 'water_breathing'
    | 'swiftness'
    | 'iron_skin'
    | 'regeneration'
    | 'gatherer'
    | 'radiance';

export const PASSIVES: Passive[] = [
    'vampirism',
    'second_wind',
    'double_jump',
    'water_breathing',
    'swiftness',
    'iron_skin',
    'regeneration',
    'gatherer',
    'radiance',
];

/** The highest rank of an artifact or a skill. */
export const TOP_RANK = 9;

/** An artifact: its type and rank, the attribute points and the skill it gives. */
export interface Artifact {
    type: ArtifactType;
    rank: number;
    points: Partial<Attributes>;
    skill?: { name: Passive; rank: number };
}

/** What a type of artifact gives at a rank: points and a skill's rank, each a range. */
export interface ArtifactRankRules {
    points?: [number, number];
    skill?: [number, number];
}

/** A skill's values, one per rank (see config/heroes.php `artifact_skills`). */
export interface PassiveRules {
    vampirism: { heal: number[] };
    second_wind: { health: number[]; cooldown: number[] };
    double_jump: { jumps: number[]; height: number[] };
    water_breathing: { breath: number[]; swim: number[] };
    swiftness: { speed: number[] };
    iron_skin: { block: number[] };
    regeneration: { health: number[] };
    gatherer: { gather: number[] };
    radiance: { light: number[] };
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
    artifacts: {
        types: ArtifactType[];
        mortal_up_to: number;
        stats: Record<string, ArtifactRankRules>;
        skill: Record<string, ArtifactRankRules>;
        type_chances: Record<ArtifactType, number>;
        rank_chances: Record<string, number[]>;
        world_level: { metres: number; hero_levels: number; max: number };
        drops: { dig: number; creature: number };
        respawn_minutes: number;
        merge: number;
        stash: number;
        tree_cells: number[];
    };
    artifact_skills: PassiveRules;
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
    look?: Appearance;
    artifacts?: { stash: Artifact[]; tree: (Artifact | null)[] };
    /** Before the lineage tree: artifact id → times absorbed. */
    absorbed?: Record<string, number>;
}

/** What a type of artifact gives at a rank (nothing for a rank there is not). */
export function artifactRules(
    type: ArtifactType,
    rank: number,
): ArtifactRankRules | undefined {
    return RULES.artifacts[type][String(rank)];
}

/** Cells of the lineage tree open at a level. */
export function treeCells(level: number): number {
    return RULES.artifacts.tree_cells.filter((at) => at <= level).length;
}

/** A saved artifact, if it is one the rules allow (the server checks the same). */
export function readArtifact(saved: unknown): Artifact | null {
    const source = saved as Partial<Artifact> | null;

    if (
        !source ||
        !ARTIFACT_TYPES.includes(source.type as ArtifactType) ||
        !Number.isInteger(source.rank)
    ) {
        return null;
    }

    const rules = artifactRules(source.type!, source.rank!);

    if (!rules) {
        return null;
    }

    const points: Partial<Attributes> = {};
    let sum = 0;

    for (const attribute of ATTRIBUTES) {
        const amount = source.points?.[attribute];

        if (Number.isInteger(amount) && amount! > 0) {
            points[attribute] = amount;
            sum += amount!;
        }
    }

    const [least, most] = rules.points ?? [0, 0];

    if (sum < least || sum > most) {
        return null;
    }

    const artifact: Artifact = {
        type: source.type!,
        rank: source.rank!,
        points,
    };
    const skill = source.skill;

    if (rules.skill) {
        if (
            !skill ||
            !PASSIVES.includes(skill.name) ||
            !Number.isInteger(skill.rank) ||
            skill.rank < rules.skill[0] ||
            skill.rank > rules.skill[1]
        ) {
            return null;
        }

        artifact.skill = { name: skill.name, rank: skill.rank };
    }

    return artifact;
}

/** All the attribute points an artifact gives. */
export function pointsOf(artifact: Artifact): number {
    return ATTRIBUTES.reduce(
        (sum, attribute) => sum + (artifact.points[attribute] ?? 0),
        0,
    );
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
    /** Artifacts found and not in the tree. */
    readonly stash: Artifact[] = [];
    /** The lineage tree's open cells: an artifact, or an empty place. */
    readonly tree: (Artifact | null)[] = [];

    /** Hairstyle, hair colour, beard and eyes. */
    look: Appearance;

    constructor(
        readonly heroClass: HeroClass,
        readonly gender: Gender,
        look?: Appearance,
    ) {
        this.look = look ?? readAppearance(null, gender);
        this.openCells();
    }

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

        const hero = new Hero(
            source.class!,
            source.gender!,
            readAppearance(source.look, source.gender!),
        );
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

        hero.openCells();
        (source.artifacts?.tree ?? [])
            .slice(0, hero.tree.length)
            .forEach((saved, cell) => {
                hero.tree[cell] = readArtifact(saved);
            });

        for (const saved of source.artifacts?.stash ?? []) {
            const artifact = readArtifact(saved);

            if (artifact) {
                hero.keep(artifact);
            }
        }

        return hero;
    }

    /**
     * Where each attribute comes from: the class (with the gender), the
     * levels, the free points and the artifacts in the tree.
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
            artifacts: this.tree.reduce(
                (sum, artifact) => sum + (artifact?.points[attribute] ?? 0),
                0,
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
        derived.speed *= 1 + this.passive('swiftness', 'speed');
        derived.healthRegen += this.passive('regeneration', 'health');

        return derived;
    }

    /** The rank of a skill from the artifacts in the tree (0 without it): the highest one. */
    skillRank(name: Passive): number {
        return this.tree.reduce(
            (best, artifact) =>
                artifact?.skill?.name === name
                    ? Math.max(best, artifact.skill.rank)
                    : best,
            0,
        );
    }

    /** A value of a skill at the rank the hero has it (0 without it). */
    passive<S extends Passive>(name: S, key: keyof PassiveRules[S]): number {
        const rank = this.skillRank(name);
        const values = RULES.artifact_skills[name][key] as number[];

        return rank > 0 ? (values[rank - 1] ?? 0) : 0;
    }

    /** The skills the tree gives, at their ranks. */
    get passives(): { name: Passive; rank: number }[] {
        return PASSIVES.map((name) => ({
            name,
            rank: this.skillRank(name),
        })).filter(({ rank }) => rank > 0);
    }

    /** Whether the store has room for one more. */
    get stashFull(): boolean {
        return this.stash.length >= RULES.artifacts.stash;
    }

    /** Puts a found artifact into the store; false when it is full. */
    keep(artifact: Artifact): boolean {
        if (this.stashFull) {
            return false;
        }

        this.stash.push(artifact);

        return true;
    }

    /**
     * Puts an artifact from the store into a cell of the tree; whatever
     * was there goes back to the store. False when there is no such cell.
     */
    place(index: number, cell: number): boolean {
        const artifact = this.stash[index];

        if (!artifact || cell < 0 || cell >= this.tree.length) {
            return false;
        }

        const old = this.tree[cell];
        this.stash.splice(index, 1);
        this.tree[cell] = artifact;

        if (old) {
            this.stash.push(old);
        }

        return true;
    }

    /** Takes an artifact out of the tree into the store; false when it cannot. */
    takeOut(cell: number): boolean {
        const artifact = this.tree[cell];

        if (!artifact || this.stashFull) {
            return false;
        }

        this.tree[cell] = null;
        this.stash.push(artifact);

        return true;
    }

    /** Opens the cells the level has reached (as empty places). */
    private openCells(): void {
        while (this.tree.length < treeCells(this.level)) {
            this.tree.push(null);
        }
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

        this.openCells();

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
            look: { ...this.look },
            artifacts: {
                stash: this.stash.map(copyArtifact),
                tree: this.tree.map((artifact) =>
                    artifact ? copyArtifact(artifact) : null,
                ),
            },
        };
    }
}

function copyArtifact(artifact: Artifact): Artifact {
    return {
        type: artifact.type,
        rank: artifact.rank,
        points: { ...artifact.points },
        ...(artifact.skill ? { skill: { ...artifact.skill } } : {}),
    };
}
