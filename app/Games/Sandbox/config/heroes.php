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
        'merge' => 30,
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
    | Artifacts are not items: picked up, they go to the hero's own store
    | (`stash`, apart from the inventory) and from there into the lineage
    | tree, whose cells are what counts. A cell takes any artifact; putting
    | one into a taken cell sends the old one back to the store. Cells open
    | as the hero grows (`tree_cells`: the level each one opens at). Until
    | something is put in, a cell is an empty place.
    |
    | Ranks, 1 to 9:
    |
    | - 1–5, mortal: 1 common, 2 a little better, 3 good, 4 elite, 5 peak;
    | - 6–9, immortal: a new layer — 6 already far stronger than 5, and
    |   every rank above stronger still, with more on top; 9 the best.
    |
    | Types (`types`), and what each gives by rank:
    |
    | - stats: attribute points (`points`: between min and max, shared out
    |   at random over strength, agility and spirit). From rank 6 also a
    |   skill (`skill`: its rank between min and max); rank 9 gives
    |   tremendous points and a skill of rank 8 — the other type's power.
    | - skill: one skill of the artifact's rank (see `skills` below). From
    |   rank 6 also points; rank 9 gives a rank 9 skill and as many points
    |   as a rank 8 stats artifact.
    |
    | Where they come from: the glowing spots in the world (back after
    | `respawn_minutes`), digs and slain creatures (`drops`: the chance
    | for each). The rank is rolled from `rank_chances` by the world level:
    | one level more every `world_level.metres` from the start and every
    | `world_level.hero_levels` levels of the hero, up to `max`. Three of
    | the same type and rank merge (`merge`) into one of the next rank.
    |
    */
    'artifacts' => [
        'types' => ['stats', 'skill'],

        // Ranks up to this one are mortal, the ones above immortal.
        'mortal_up_to' => 5,

        'stats' => [
            1 => ['points' => [4, 5]],
            2 => ['points' => [7, 8]],
            3 => ['points' => [11, 13]],
            4 => ['points' => [16, 19]],
            5 => ['points' => [23, 27]],
            6 => ['points' => [58, 68], 'skill' => [1, 3]],
            7 => ['points' => [100, 115], 'skill' => [2, 4]],
            8 => ['points' => [165, 185], 'skill' => [3, 5]],
            9 => ['points' => [280, 320], 'skill' => [8, 8]],
        ],

        'skill' => [
            1 => ['skill' => [1, 1]],
            2 => ['skill' => [2, 2]],
            3 => ['skill' => [3, 3]],
            4 => ['skill' => [4, 4]],
            5 => ['skill' => [5, 5]],
            6 => ['skill' => [6, 6], 'points' => [11, 13]],
            7 => ['skill' => [7, 7], 'points' => [23, 27]],
            8 => ['skill' => [8, 8], 'points' => [58, 68]],
            9 => ['skill' => [9, 9], 'points' => [165, 185]],
        ],

        // Percent of each type among the artifacts found.
        'type_chances' => ['stats' => 75, 'skill' => 25],

        // Percent for ranks 1…9, by world level.
        'rank_chances' => [
            1 => [70, 22, 6, 1.5, 0.4, 0.08, 0.015, 0.004, 0.001],
            2 => [50, 30, 13, 5, 1.5, 0.4, 0.08, 0.015, 0.005],
            3 => [30, 32, 22, 10, 4, 1.5, 0.4, 0.08, 0.02],
            4 => [15, 25, 27, 18, 9, 4, 1.5, 0.4, 0.1],
            5 => [5, 15, 25, 25, 15, 9, 4, 1.5, 0.5],
        ],

        'world_level' => ['metres' => 60, 'hero_levels' => 15, 'max' => 5],

        // Chance of an artifact from a dig, from a slain creature.
        'drops' => ['dig' => 0.08, 'creature' => 0.04],

        'respawn_minutes' => 5,

        // How many of the same type and rank merge into one of the next.
        'merge' => 3,

        // The most artifacts the store keeps.
        'stash' => 60,

        // The hero level each cell of the lineage tree opens at.
        'tree_cells' => [1, 1, 1, 3, 5, 7, 10, 13, 16, 20, 25, 30, 35, 40, 45, 50],
    ],

    /*
     * The skills artifacts give, each with a value per rank (1…9). A hero
     * with the same skill from two artifacts has the higher rank of the two.
     *
     * - vampirism: share of melee damage that heals;
     * - second_wind: a lethal blow leaves this share of health instead, at
     *   most once every `cooldown` seconds;
     * - double_jump: jumps in the air, and how much higher every jump goes;
     * - water_breathing: how much longer the breath lasts (0 = for ever),
     *   and how much faster swimming is;
     * - swiftness: share faster on foot;
     * - iron_skin: share of every blow not taken;
     * - regeneration: health back per second, on top of the usual;
     * - gatherer: share more from trees, rocks and finds;
     * - radiance: glows at night, this many times as bright.
     */
    'artifact_skills' => [
        'vampirism' => ['heal' => [0.02, 0.03, 0.04, 0.05, 0.07, 0.12, 0.17, 0.23, 0.35]],
        'second_wind' => [
            'health' => [0.1, 0.13, 0.16, 0.2, 0.25, 0.4, 0.5, 0.65, 1],
            'cooldown' => [600, 540, 480, 420, 360, 240, 180, 120, 60],
        ],
        'double_jump' => [
            'jumps' => [1, 1, 1, 1, 1, 2, 2, 3, 4],
            'height' => [0, 0.03, 0.06, 0.09, 0.12, 0.25, 0.35, 0.5, 0.7],
        ],
        'water_breathing' => [
            'breath' => [1.5, 2, 2.5, 3, 4, 8, 15, 30, 0],
            'swim' => [0, 0.05, 0.1, 0.15, 0.2, 0.4, 0.55, 0.75, 1],
        ],
        'swiftness' => ['speed' => [0.03, 0.05, 0.07, 0.09, 0.12, 0.2, 0.26, 0.33, 0.45]],
        'iron_skin' => ['block' => [0.02, 0.04, 0.06, 0.08, 0.1, 0.18, 0.24, 0.3, 0.4]],
        'regeneration' => ['health' => [0.2, 0.35, 0.5, 0.7, 1, 2.5, 4, 6, 10]],
        'gatherer' => ['gather' => [0.1, 0.15, 0.2, 0.3, 0.4, 0.7, 1, 1.4, 2]],
        'radiance' => ['light' => [1, 1.1, 1.2, 1.35, 1.5, 2, 2.4, 2.8, 3.5]],
    ],

    /*
     * How the hero can look: hairstyle, hair colour, beard and eye colour.
     * Only the names — the client draws them (client/player/looks.ts).
     */
    'looks' => [
        'hair' => ['short', 'parted', 'buns', 'bob', 'ponytail', 'long', 'bald'],
        'hair_color' => ['black', 'brown', 'chestnut', 'auburn', 'blonde', 'platinum', 'pink', 'blue'],
        'beard' => ['none', 'stubble', 'mustache', 'goatee', 'full'],
        'eyes' => ['brown', 'hazel', 'green', 'blue', 'grey', 'violet'],
    ],

];
