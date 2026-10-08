/**
 * Artifacts and what can be done with them besides carrying them:
 *
 * - absorb — gone for good, but its attributes, bonuses or skill stay
 *   with the hero (what each gives is in config/heroes.php, `artifacts`);
 * - recycle — turned into essence, more for rarer ones;
 * - fuse — legendary artifacts are made only from others and essence.
 *
 * Common ones lie about the world and the five rare ones hide one per
 * land; both come back a few minutes after being picked up.
 */

import { artifactRules, RULES } from './hero';
import type { ArtifactTier } from './hero';
import type { ArtifactId, ItemId } from './items';

export const TIERS: ArtifactTier[] = ['common', 'rare', 'legendary'];

/** Every artifact, by tier, in the order the artifacts tab shows them. */
export const ARTIFACT_LIST: Record<ArtifactTier, ArtifactId[]> = {
    common: [
        'strength_rune',
        'agility_rune',
        'spirit_rune',
        'vital_shard',
        'mana_pearl',
        'swift_charm',
    ],
    rare: [
        'golden_clover',
        'forest_heart',
        'sun_stone',
        'frost_crystal',
        'wind_feather',
    ],
    legendary: ['storm_eye', 'deep_pearl', 'blood_ruby', 'phoenix_feather'],
};

export interface Fusion {
    result: ArtifactId;
    needs: [ItemId, number][];
}

/** How the legendary artifacts are made. */
export const FUSIONS: Fusion[] = [
    {
        result: 'storm_eye',
        needs: [
            ['wind_feather', 1],
            ['agility_rune', 2],
            ['essence', 8],
        ],
    },
    {
        result: 'deep_pearl',
        needs: [
            ['frost_crystal', 1],
            ['mana_pearl', 2],
            ['essence', 8],
        ],
    },
    {
        result: 'blood_ruby',
        needs: [
            ['vital_shard', 2],
            ['strength_rune', 2],
            ['essence', 10],
        ],
    },
    {
        result: 'phoenix_feather',
        needs: [
            ['sun_stone', 1],
            ['forest_heart', 1],
            ['vital_shard', 1],
            ['essence', 12],
        ],
    },
];

export function tierOf(artifact: ArtifactId): ArtifactTier {
    return artifactRules(artifact)?.tier ?? 'common';
}

/** Essence the artifact turns into when recycled. */
export function essenceOf(artifact: ArtifactId): number {
    return RULES.essence[tierOf(artifact)];
}

export function fusionFor(artifact: ArtifactId): Fusion | undefined {
    return FUSIONS.find((fusion) => fusion.result === artifact);
}
