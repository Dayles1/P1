<?php

namespace App\Games\Sandbox;

/**
 * The hero rules of config/heroes.php worked out: a class's starting
 * attributes for a gender, the free points earned up to a level, the
 * attributes at a level (with what absorbed artifacts add) and the values
 * derived from them. The browser client does the same sums
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
     * Artifacts that can be absorbed.
     *
     * @return list<string>
     */
    public static function artifacts(): array
    {
        return array_keys(self::artifactRules());
    }

    /**
     * How many times an artifact can be absorbed (0 for anything else).
     */
    public static function absorbLimit(string $artifact): int
    {
        return (int) (self::artifactRules()[$artifact]['max'] ?? 0);
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
     * Attributes at a level, with the free points put in and what absorbed
     * artifacts add.
     *
     * @param  array<string, int>  $points
     * @param  array<string, int>  $absorbed
     * @return array<string, int>
     */
    public static function attributesAt(string $class, string $gender, int $level, array $points = [], array $absorbed = []): array
    {
        $growth = (int) self::rules('levels.per_level') * ($level - 1);

        return collect(self::startingAttributes($class, $gender))
            ->map(fn (int $value, string $attribute): int => $value + $growth
                + max(0, (int) ($points[$attribute] ?? 0))
                + self::fromArtifacts($absorbed, 'attributes', $attribute))
            ->all();
    }

    /**
     * What absorbed artifacts add up to for one attribute or bonus.
     *
     * @param  array<string, int>  $absorbed
     */
    public static function fromArtifacts(array $absorbed, string $kind, string $key): int
    {
        $total = 0;
        $rules = self::artifactRules();

        foreach ($absorbed as $artifact => $times) {
            $total += (int) ($rules[$artifact][$kind][$key] ?? 0) * min(max(0, (int) $times), self::absorbLimit($artifact));
        }

        return $total;
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
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, absorbed?: array<string, int>}|null  $hero
     */
    public static function maxHealth(?array $hero): float
    {
        return $hero === null
            ? 100.0
            : self::derive('health', self::heroAttributes($hero)) + self::fromArtifacts($hero['absorbed'] ?? [], 'bonus', 'health');
    }

    /**
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, absorbed?: array<string, int>}|null  $hero
     */
    public static function maxMana(?array $hero): float
    {
        return $hero === null
            ? 0.0
            : self::derive('mana', self::heroAttributes($hero)) + self::fromArtifacts($hero['absorbed'] ?? [], 'bonus', 'mana');
    }

    /**
     * @param  array{class?: string, gender?: string, level?: int, points?: array<string, int>, absorbed?: array<string, int>}  $hero
     * @return array<string, int>
     */
    private static function heroAttributes(array $hero): array
    {
        return self::attributesAt($hero['class'] ?? 'fighter', $hero['gender'] ?? 'male', (int) ($hero['level'] ?? 1), $hero['points'] ?? [], $hero['absorbed'] ?? []);
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
     * What absorbing each artifact gives.
     *
     * @return array<string, array{tier: string, max: int, attributes?: array<string, int>, bonus?: array<string, float|int>, skill?: string}>
     */
    private static function artifactRules(): array
    {
        return self::rules('artifacts');
    }

    private static function rules(string $key): mixed
    {
        return config("sandbox.heroes.{$key}");
    }
}
