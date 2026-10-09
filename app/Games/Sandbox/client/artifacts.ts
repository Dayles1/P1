/**
 * Artifacts: how they are rolled when found, merged and shown. The rules
 * — types, ranks 1 to 9, what each gives, the chances — are the server's
 * (config/heroes.php `artifacts`); a found artifact goes to the hero's
 * store, not the inventory, and from there into the lineage tree.
 *
 * - found: in the glowing spots of the world, in digs, from slain
 *   creatures; the rank is rolled by the world level (further from the
 *   start, and a stronger hero, find better ones);
 * - merged: three of the same type and rank make one of the next rank.
 *
 * Each one looks like a living Gu (see gu.ts). Saves from before ranks
 * had artifacts as items and "absorbed" them;
 * those become ranked ones in the store (see fromOldSave).
 */

import { guIcon } from './gu';
import {
    ARTIFACT_TYPES,
    artifactRules,
    ATTRIBUTES,
    PASSIVES,
    RULES,
    TOP_RANK,
} from './hero';
import type { Artifact, ArtifactType, Attributes, Passive } from './hero';

type Random = () => number;

/** Whether a rank is of the immortal layer (6 and up). */
export function immortal(rank: number): boolean {
    return rank > RULES.artifacts.mortal_up_to;
}

/** The picture of an artifact: its Gu (see gu.ts), its rank round it. */
export function artifactIcon(artifact: Artifact): string {
    return guIcon(artifact);
}

/**
 * How far the world has come at a spot: a level more every so many
 * metres from the start and every so many levels of the hero.
 */
export function worldLevel(x: number, z: number, heroLevel: number): number {
    const { metres, hero_levels, max } = RULES.artifacts.world_level;
    const level =
        1 +
        Math.floor(Math.hypot(x, z) / metres) +
        Math.floor((heroLevel - 1) / hero_levels);

    return Math.max(1, Math.min(max, level));
}

/** Picks an index by weights. */
function weighted(weights: number[], random: Random): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;

    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];

        if (roll < 0) {
            return i;
        }
    }

    return weights.length - 1;
}

function between([least, most]: [number, number], random: Random): number {
    return least + Math.floor(random() * (most - least + 1));
}

/** Points shared out over the attributes, mostly to one or two of them. */
function shareOut(total: number, random: Random): Partial<Attributes> {
    const weights = ATTRIBUTES.map(() => random() ** 2 + 0.05);
    const sum = weights.reduce((a, b) => a + b, 0);
    const points: Partial<Attributes> = {};
    let left = total;

    ATTRIBUTES.forEach((attribute, index) => {
        const share = Math.floor((total * weights[index]) / sum);
        points[attribute] = share;
        left -= share;
    });

    while (left > 0) {
        const attribute = ATTRIBUTES[weighted(weights, random)];
        points[attribute] = (points[attribute] ?? 0) + 1;
        left--;
    }

    for (const attribute of ATTRIBUTES) {
        if (!points[attribute]) {
            delete points[attribute];
        }
    }

    return points;
}

/** A new artifact of a type and rank; `skill` keeps a skill's name (when merging). */
export function rollArtifact(
    type: ArtifactType,
    rank: number,
    random: Random = Math.random,
    skill?: Passive,
): Artifact {
    const rules = artifactRules(type, rank)!;
    const artifact: Artifact = {
        type,
        rank,
        points: rules.points
            ? shareOut(between(rules.points, random), random)
            : {},
    };

    if (rules.skill) {
        artifact.skill = {
            name: skill ?? PASSIVES[Math.floor(random() * PASSIVES.length)],
            rank: between(rules.skill, random),
        };
    }

    return artifact;
}

/** An artifact found at a spot of the world, by its world level. */
export function findArtifact(
    x: number,
    z: number,
    heroLevel: number,
    random: Random = Math.random,
): Artifact {
    const chances =
        RULES.artifacts.rank_chances[String(worldLevel(x, z, heroLevel))];
    const types = RULES.artifacts.type_chances;
    const type =
        ARTIFACT_TYPES[
            weighted(
                ARTIFACT_TYPES.map((each) => types[each]),
                random,
            )
        ];

    return rollArtifact(type, weighted(chances, random) + 1, random);
}

/**
 * Indices in the store of artifacts to merge with the one at `index`:
 * it and others of its type and rank, as many as a merge takes — or null
 * when there are not enough, or it is already of the top rank.
 */
export function mergeGroup(stash: Artifact[], index: number): number[] | null {
    const chosen = stash[index];

    if (!chosen || chosen.rank >= TOP_RANK) {
        return null;
    }

    const group = [index];

    stash.forEach((other, at) => {
        if (
            at !== index &&
            group.length < RULES.artifacts.merge &&
            other.type === chosen.type &&
            other.rank === chosen.rank
        ) {
            group.push(at);
        }
    });

    return group.length === RULES.artifacts.merge ? group : null;
}

/** What merging gives: the next rank of the type, keeping the commonest skill. */
export function merged(
    artifacts: Artifact[],
    random: Random = Math.random,
): Artifact {
    const [first] = artifacts;
    const counts = new Map<Passive, number>();

    for (const artifact of artifacts) {
        if (artifact.skill) {
            counts.set(
                artifact.skill.name,
                (counts.get(artifact.skill.name) ?? 0) + 1,
            );
        }
    }

    const skill = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    return rollArtifact(first.type, first.rank + 1, random, skill);
}

/** The old artifacts and what each becomes now. */
const OLD: Record<
    string,
    { type: ArtifactType; rank: number; skill?: Passive }
> = {
    strength_rune: { type: 'stats', rank: 1 },
    agility_rune: { type: 'stats', rank: 1 },
    spirit_rune: { type: 'stats', rank: 1 },
    vital_shard: { type: 'stats', rank: 1 },
    mana_pearl: { type: 'stats', rank: 1 },
    swift_charm: { type: 'skill', rank: 1, skill: 'swiftness' },
    golden_clover: { type: 'skill', rank: 3, skill: 'swiftness' },
    wind_feather: { type: 'skill', rank: 3, skill: 'double_jump' },
    frost_crystal: { type: 'skill', rank: 3, skill: 'water_breathing' },
    forest_heart: { type: 'skill', rank: 3, skill: 'gatherer' },
    sun_stone: { type: 'skill', rank: 3, skill: 'radiance' },
    storm_eye: { type: 'skill', rank: 5, skill: 'double_jump' },
    deep_pearl: { type: 'skill', rank: 5, skill: 'water_breathing' },
    blood_ruby: { type: 'skill', rank: 5, skill: 'vampirism' },
    phoenix_feather: { type: 'skill', rank: 5, skill: 'second_wind' },
};

/** Whether an item id is one of the old artifacts. */
export function isOldArtifact(item: unknown): item is string {
    return typeof item === 'string' && item in OLD;
}

/**
 * The ranked artifacts for what a save from before ranks had: old
 * artifacts absorbed (id → times) and carried (ids, one per piece).
 */
export function fromOldSave(
    absorbed: Record<string, number>,
    carried: string[],
): Artifact[] {
    const ids = [
        ...Object.entries(absorbed).flatMap(([id, times]) =>
            Array.from({ length: Math.max(0, Math.floor(times)) }, () => id),
        ),
        ...carried,
    ];

    return ids
        .filter(isOldArtifact)
        .map((id) =>
            rollArtifact(
                OLD[id].type,
                OLD[id].rank,
                Math.random,
                OLD[id].skill,
            ),
        );
}
