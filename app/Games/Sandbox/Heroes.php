<?php

namespace App\Games\Sandbox;

/**
 * The hero rules of config/heroes.php worked out: a class's starting
 * attributes for a gender, the free points earned up to a level, the
 * attributes at a level (with what the artifacts in the lineage tree add),
 * the values derived from them, and whether a saved artifact is one the
 * rules allow. The browser client does the same sums
 * (client/hero.ts) from the same config; the server uses them to check
 * what a save claims.
 */
class Heroes
{
    /**
     * @return list<string>
     */
    public static function classes(): array
    {
        return array_keys(self::classRules());
    }

    /**
     * @return list<string>
     */
    public static function genders(): array
    {
        return array_keys(self::genderRules());
    }

    /**
     * @return list<string>
     */
    public static function attributes(): array
    {
        return self::rules('attributes');
    }

    /**
     * @return list<string>
     */
    public static function artifactTypes(): array
    {
        return self::rules('artifacts.types');
    }

    /**
     * The skills artifacts give.
     *
     * @return list<string>
     */
    public static function artifactSkills(): array
    {
        return array_keys(self::skillRules());
    }

    /**
     * The most artifacts the hero's store keeps.
     */
    public static function stashSize(): int
    {
        return (int) self::rules('artifacts.stash');
    }

    /**
     * Cells of the lineage tree open at a level.
     */
    public static function treeCells(int $level): int
    {
        return count(array_filter(self::cellLevels(), fn (int $at): bool => $at <= $level));
    }

    /**
     * Whether a saved artifact is one the rules allow: a known type and a
     * rank from 1 to 9; attribute points (if its type and rank give any)
     * adding up to within the rank's range; a skill (if they give one)
     * with a rank in its range — and nothing they do not give.
     */
    public static function isArtifact(mixed $artifact): bool
    {
        if (! is_array($artifact) || array_diff(array_keys($artifact), ['type', 'rank', 'points', 'skill']) !== []) {
            return false;
        }

        $type = $artifact['type'] ?? null;
        $rank = $artifact['rank'] ?? null;

        if (! in_array($type, self::artifactTypes(), true) || ! is_int($rank)) {
            return false;
        }

        $rule = self::rules("artifacts.{$type}.{$rank}");

        if (! is_array($rule)) {
            return false;
        }

        return self::allowedPoints($artifact['points'] ?? [], $rule['points'] ?? null)
            && self::allowedSkill($artifact['skill'] ?? null, $rule['skill'] ?? null);
    }

    /**
     * Attribute points the artifacts in the tree add to one attribute.
     *
     * @param  array<int, mixed>  $tree
     */
    public static function fromTree(array $tree, string $attribute): int
    {
        return collect($tree)
            ->sum(fn (mixed $artifact): int => is_array($artifact) ? max(0, (int) ($artifact['points'][$attribute] ?? 0)) : 0);
    }

    /**
     * The choices for a part of the hero's look (hair, hair_color, beard, eyes).
     *
     * @return list<string>
     */
    public static function looks(string $part): array
    {
        return self::rules("looks.{$part}") ?? [];
    }

    public static function maxLevel(): int
    {
        return (int) self::rules('levels.max');
    }

    /**
     * The class's attributes with what the gender changes.
     *
     * @return array<string, int>
     */
    public static function startingAttributes(string $class, string $gender): array
    {
        $base = self::classRules()[$class];
        $shifts = self::genderRules()[$gender];
        $shift = $shifts[$class] ?? $shifts['default'] ?? [];

        return collect(self::attributes())
            ->mapWithKeys(fn (string $attribute): array => [$attribute => (int) $base[$attribute] + (int) ($shift[$attribute] ?? 0)])
            ->all();
    }

    /**
     * Free points earned by reaching the level.
     */
    public static function bonusPointsUpTo(int $level): int
    {
        $points = 0;

        foreach (self::rules('levels.bonus_points') as $at => $each) {
            if ($at <= $level) {
                $points += (int) $each;
            }
        }

        ['from' => $from, 'step' => $step, 'points' => $each] = self::rules('levels.bonus_every');

        for ($at = $from; $at <= $level; $at += $step) {
            $points += $each;
        }

        return $points;
    }

    /**
     * What it takes to go from the level to the next one.
     */
    public static function experienceToNext(int $level): int
    {
        ['base' => $base, 'power' => $power] = self::rules('levels.xp');

        return (int) round($base * $level ** $power);
    }

    /**
     * Attributes at a level, with the free points put in and what the
     * artifacts in the lineage tree add.
     *
     * @param  array<string, int>  $points
     * @param  array<int, mixed>  $tree
     * @return array<string, int>
     */
    public static function attributesAt(string $class, string $gender, int $level, array $points = [], array $tree = []): array
    {
        $growth = (int) self::rules('levels.per_level') * ($level - 1);

        return collect(self::startingAttributes($class, $gender))
            ->map(fn (int $value, string $attribute): int => $value + $growth
                + max(0, (int) ($points[$attribute] ?? 0))
                + self::fromTree($tree, $attribute))
            ->all();
    }

    /**
     * A derived value (health, mana, defense…) for the attributes.
     *
     * @param  array<string, int>  $attributes
     */
    public static function derive(string $formula, array $attributes): float
    {
        $terms = self::rules("formulas.{$formula}");
        $value = (float) ($terms['base'] ?? 0);

        foreach ($attributes as $attribute => $amount) {
            $value += (float) ($terms[$attribute] ?? 0) * $amount;
        }

        if (isset($terms['min'])) {
            $value = max((float) $terms['min'], $value);
        }

        if (isset($terms['max'])) {
            $value = min((float) $terms['max'], $value);
        }

        return $value;
    }

    /**
     * Most health a saved hero can have; characters from before heroes
     * had 100.
     *
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, artifacts?: array{stash?: array<int, mixed>, tree?: array<int, mixed>}}|null  $hero
     */
    public static function maxHealth(?array $hero): float
    {
        return $hero === null ? 100.0 : self::derive('health', self::heroAttributes($hero));
    }

    /**
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, artifacts?: array{stash?: array<int, mixed>, tree?: array<int, mixed>}}|null  $hero
     */
    public static function maxMana(?array $hero): float
    {
        return $hero === null ? 0.0 : self::derive('mana', self::heroAttributes($hero));
    }

    /**
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, artifacts?: array{stash?: array<int, mixed>, tree?: array<int, mixed>}}  $hero
     * @return array<string, int>
     */
    private static function heroAttributes(array $hero): array
    {
        return self::attributesAt($hero['class'] ?? 'fighter', $hero['gender'] ?? 'male', (int) ($hero['level'] ?? 1), $hero['points'] ?? [], $hero['artifacts']['tree'] ?? []);
    }

    /**
     * Attribute points within a range (none when there is no range).
     *
     * @param  array{0: int, 1: int}|null  $range
     */
    private static function allowedPoints(mixed $points, ?array $range): bool
    {
        if (! is_array($points) || array_diff(array_keys($points), self::attributes()) !== []) {
            return false;
        }

        foreach ($points as $amount) {
            if (! is_int($amount) || $amount < 0) {
                return false;
            }
        }

        $sum = array_sum($points);

        return $range === null ? $sum === 0 : $sum >= $range[0] && $sum <= $range[1];
    }

    /**
     * A skill with a rank within a range (none when there is no range).
     *
     * @param  array{0: int, 1: int}|null  $range
     */
    private static function allowedSkill(mixed $skill, ?array $range): bool
    {
        if ($range === null || $skill === null) {
            return $range === null && $skill === null;
        }

        return is_array($skill)
            && array_diff(array_keys($skill), ['name', 'rank']) === []
            && in_array($skill['name'] ?? null, self::artifactSkills(), true)
            && is_int($skill['rank'] ?? null)
            && $skill['rank'] >= $range[0]
            && $skill['rank'] <= $range[1];
    }

    /**
     * Starting attributes by class.
     *
     * @return array<string, array<string, int>>
     */
    private static function classRules(): array
    {
        return self::rules('classes');
    }

    /**
     * What each gender changes, by class (or `default`).
     *
     * @return array<string, array<string, array<string, int>>>
     */
    private static function genderRules(): array
    {
        return self::rules('genders');
    }

    /**
     * Each skill artifacts give: its values, one per rank.
     *
     * @return array<string, array<string, list<float|int>>>
     */
    private static function skillRules(): array
    {
        return self::rules('artifact_skills');
    }

    /**
     * The level each cell of the lineage tree opens at.
     *
     * @return list<int>
     */
    private static function cellLevels(): array
    {
        return self::rules('artifacts.tree_cells');
    }

    private static function rules(string $key): mixed
    {
        return config("sandbox.heroes.{$key}");
    }
}
