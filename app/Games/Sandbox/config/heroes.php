<?php

/*
|--------------------------------------------------------------------------
| Sandbox — heroes
|--------------------------------------------------------------------------
|
| Every rule about the character in one place: classes, what being a man
| or a woman changes, levels and the points they give, the formulas for
| health, mana, stamina, defence and the rest, experience, the class
| skills and how creatures grow with the player. Merged as the
| `sandbox.heroes` config by SandboxServiceProvider; the server checks
| saves against it and the browser client gets the same array (see
| views/app.blade.php), so changing a number here changes the game.
|
| The three attributes:
|
| - strength: how hard blows land; health (only the base amount — level
|   ups add to it through strength like everything else); defence;
| - agility:  how fast the character moves and swings, critical hits;
|   stamina together with strength; takes a little off defence;
| - spirit:   mana, mana regeneration, spell power and how much is
|   learnt from notes and finds (the "intelligence" of other games — it
|   is not how clever the character is).
|
*/

return [

    'attributes' => ['strength', 'agility', 'spirit'],

    /*
     * Starting attributes per class: 30 points each, split by what the
     * class is good at.
     */
    'classes' => [
        'tank' => ['strength' => 18, 'agility' => 5, 'spirit' => 7],
        'fighter' => ['strength' => 15, 'agility' => 8, 'spirit' => 7],
        'assassin' => ['strength' => 7, 'agility' => 15, 'spirit' => 8],
        'mage' => ['strength' => 8, 'agility' => 5, 'spirit' => 17],
    ],

    /*
     * What the gender adds to the class's attributes. Women are quicker
     * but weaker: two points move from strength to agility for a tank,
     * one for everyone else. The total stays 30.
     */
    'genders' => [
        'male' => [
            'default' => [],
        ],
        'female' => [
            'tank' => ['strength' => -2, 'agility' => 2],
            'default' => ['strength' => -1, 'agility' => 1],
        ],
    ],

    'levels' => [
        'max' => 50,

        /*
         * Every level up adds this much to every attribute.
         */
        'per_level' => 1,

        /*
         * Free points to put into any attribute: on these levels…
         */
        'bonus_points' => [3 => 1, 5 => 1],

        /*
         * …and on every `step`-th level from `from` on (10, 15, 20, 25…).
         */
        'bonus_every' => ['from' => 10, 'step' => 5, 'points' => 2],

        /*
         * Experience from level n to n + 1: round(base × n ^ power).
         */
        'xp' => ['base' => 40, 'power' => 1.4],
    ],

    /*
     * Every derived value is base + Σ attribute × factor, kept between
     * min and max when those are given.
     */
    'formulas' => [
        'health' => ['base' => 50, 'strength' => 10],
        'mana' => ['base' => 50, 'spirit' => 10],
        'stamina' => ['base' => 50, 'strength' => 4, 'agility' => 4],

        /*
         * Defence points work like armour points (and add to them): the
         * share of a blow stopped is points / (points + 25).
         */
        'defense' => ['strength' => 0.6, 'agility' => -0.25, 'min' => 0],

        /*
         * Multiplies the damage of every blow.
         */
        'damage' => ['base' => 0.55, 'strength' => 0.03],

        /*
         * Multiplies walking, running and swimming speed.
         */
        'speed' => ['base' => 0.9, 'agility' => 0.01, 'max' => 1.4],

        /*
         * Multiplies how quickly blows follow each other.
         */
        'attack_speed' => ['base' => 0.9, 'agility' => 0.012, 'max' => 1.6],

        /*
         * Chance (0…1) that a blow is critical: it then does `crit_damage`
         * times as much.
         */
        'crit' => ['agility' => 0.008, 'max' => 0.5],
        'crit_damage' => ['base' => 1.75],

        /*
         * Per second.
         */
        'health_regen' => ['base' => 0.6, 'strength' => 0.04],
        'mana_regen' => ['base' => 0.5, 'spirit' => 0.06],
        'stamina_regen' => ['base' => 12, 'agility' => 0.3],

        /*
         * The mage's fire bolt.
         */
        'spell' => ['base' => 5, 'spirit' => 0.8],

        /*
         * Multiplies the knowledge got from notes, relics and taking
         * things apart.
         */
        'knowledge' => ['base' => 1, 'spirit' => 0.03],
    ],

    /*
     * What uses stamina: per second of running, per jump, per blow.
     * Out of stamina the character can only walk.
     */
    'stamina_costs' => ['sprint' => 11, 'jump' => 8, 'blow' => 3],

    /*
     * Experience for what the player does.
     */
    'xp_rewards' => [
        'deer' => 8,
        'boar' => 14,
        'wolf' => 18,
        'zombie' => 24,
        'tree' => 3,
        'rock' => 3,
        'dig' => 8,
        'craft' => 2,
        'research' => 15,
        'artifact' => 20,
        'absorb' => 25,
        'fuse' => 60,
    ],

    /*
     * One skill per class, on G (or the star button on a phone). Mana
     * cost, cooldown in seconds and what it does.
     */
    'skills' => [
        // Takes only `damage_taken` of every blow for `seconds`.
        'tank' => ['name' => 'guard', 'cost' => 30, 'cooldown' => 25, 'seconds' => 8, 'damage_taken' => 0.4],
        // Hits every creature within `radius` m for `damage` × a blow.
        'fighter' => ['name' => 'whirlwind', 'cost' => 25, 'cooldown' => 8, 'radius' => 3.2, 'damage' => 1.5],
        // A leap forward; the next blow within `seconds` is critical and
        // does `damage` × instead.
        'assassin' => ['name' => 'dash', 'cost' => 20, 'cooldown' => 6, 'speed' => 16, 'seconds' => 4, 'damage' => 2.5],
        // A bolt at the creature in front, up to `range` m away, for the
        // spell formula's damage.
        'mage' => ['name' => 'bolt', 'cost' => 18, 'cooldown' => 1.2, 'range' => 22],
    ],

    /*
     * Creatures get tougher as the player grows: per level above the
     * first, this share more health and damage.
     */
    'mob_scaling' => ['health' => 0.06, 'damage' => 0.04],

    /*
    |--------------------------------------------------------------------------
    | Artifacts
    |--------------------------------------------------------------------------
    |
    | What absorbing each artifact gives — for good: attributes, bonuses
    | and/or a skill — and how many times it can be absorbed. Carried, the
    | five rare ones still help as before (see client/items.ts); absorbed,
    | they help the same way for good and the slot is free again.
    |
    | Tiers: common ones lie about the world, rare ones hide one per land,
    | legendary ones are only fused from others (client/artifacts.ts) and
    | give a skill and nothing else.
    |
    | Bonuses: health and mana add to the maxima; speed, jump, swim, breath
    | and gather add to the multiplier (0.1 = 10% more); light makes the
    | hero glow at night.
    |
    */
    'artifacts' => [
        'strength_rune' => ['tier' => 'common', 'max' => 5, 'attributes' => ['strength' => 2]],
        'agility_rune' => ['tier' => 'common', 'max' => 5, 'attributes' => ['agility' => 2]],
        'spirit_rune' => ['tier' => 'common', 'max' => 5, 'attributes' => ['spirit' => 2]],
        'vital_shard' => ['tier' => 'common', 'max' => 5, 'bonus' => ['health' => 20]],
        'mana_pearl' => ['tier' => 'common', 'max' => 5, 'bonus' => ['mana' => 20]],
        'swift_charm' => ['tier' => 'common', 'max' => 3, 'bonus' => ['speed' => 0.05]],

        'golden_clover' => ['tier' => 'rare', 'max' => 1, 'attributes' => ['agility' => 1], 'bonus' => ['speed' => 0.15]],
        'wind_feather' => ['tier' => 'rare', 'max' => 1, 'attributes' => ['agility' => 1], 'bonus' => ['jump' => 0.3]],
        'frost_crystal' => ['tier' => 'rare', 'max' => 1, 'attributes' => ['spirit' => 1], 'bonus' => ['swim' => 0.35, 'breath' => 1]],
        'forest_heart' => ['tier' => 'rare', 'max' => 1, 'attributes' => ['strength' => 1], 'bonus' => ['gather' => 0.5]],
        'sun_stone' => ['tier' => 'rare', 'max' => 1, 'attributes' => ['spirit' => 1], 'bonus' => ['light' => 1]],

        'storm_eye' => ['tier' => 'legendary', 'max' => 1, 'skill' => 'double_jump'],
        'deep_pearl' => ['tier' => 'legendary', 'max' => 1, 'skill' => 'water_breathing'],
        'blood_ruby' => ['tier' => 'legendary', 'max' => 1, 'skill' => 'vampirism'],
        'phoenix_feather' => ['tier' => 'legendary', 'max' => 1, 'skill' => 'second_wind'],
    ],

    /*
     * Essence an artifact turns into when recycled, by tier.
     */
    'essence' => ['common' => 2, 'rare' => 6, 'legendary' => 15],

    /*
     * Minutes until a picked-up artifact appears again in the world.
     */
    'artifact_respawn_minutes' => 5,

    /*
     * The legendary skills: the share of melee damage that heals
     * (vampirism), and the health a lethal blow leaves instead — at most
     * once every `cooldown` seconds (second wind).
     */
    'passives' => [
        'vampirism' => 0.1,
        'second_wind' => ['health' => 0.3, 'cooldown' => 300],
    ],

];
