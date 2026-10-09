<?php

use App\Domain\Identity\Models\User;
use App\Games\Sandbox\Heroes;
use App\Games\Sandbox\Models\Player;

function sandboxHero(array $overrides = []): array
{
    return ['class' => 'tank', 'gender' => 'male', 'level' => 1, 'xp' => 0, 'points' => [], ...$overrides];
}

function sandboxSave(array $overrides = []): array
{
    return ['x' => 1, 'y' => 2, 'z' => 3, 'yaw' => 0, ...$overrides];
}

test('every class starts with thirty points, whichever the gender', function (string $class, string $gender) {
    expect(array_sum(Heroes::startingAttributes($class, $gender)))->toBe(30);
})->with(['tank', 'fighter', 'assassin', 'mage'])->with(['male', 'female']);

test('women trade strength for agility: two points for a tank, one for the rest', function () {
    expect(Heroes::startingAttributes('tank', 'male'))->toBe(['strength' => 18, 'agility' => 5, 'spirit' => 7])
        ->and(Heroes::startingAttributes('tank', 'female'))->toBe(['strength' => 16, 'agility' => 7, 'spirit' => 7])
        ->and(Heroes::startingAttributes('mage', 'female'))->toBe(['strength' => 7, 'agility' => 6, 'spirit' => 17])
        ->and(Heroes::startingAttributes('assassin', 'female'))->toBe(['strength' => 6, 'agility' => 16, 'spirit' => 8]);
});

test('free points come at levels 3 and 5, then two every fifth level from 10', function (int $level, int $points) {
    expect(Heroes::bonusPointsUpTo($level))->toBe($points);
})->with([
    [1, 0], [2, 0], [3, 1], [4, 1], [5, 2], [9, 2], [10, 4], [14, 4], [15, 6], [20, 8], [25, 10],
]);

test('every level adds one to every attribute, plus the points put in', function () {
    expect(Heroes::attributesAt('fighter', 'male', 5, ['agility' => 2]))
        ->toBe(['strength' => 19, 'agility' => 14, 'spirit' => 11]);
});

test('health and mana follow strength and spirit', function () {
    expect(Heroes::maxHealth(sandboxHero()))->toBe(230.0)
        ->and(Heroes::maxMana(sandboxHero()))->toBe(120.0)
        ->and(Heroes::maxHealth(sandboxHero(['class' => 'mage'])))->toBe(130.0)
        ->and(Heroes::maxMana(sandboxHero(['class' => 'mage'])))->toBe(220.0)
        ->and(Heroes::maxHealth(null))->toBe(100.0);
});

test('the page hands the client the same rules', function () {
    $this->withoutVite()
        ->get('/games/sandbox')
        ->assertOk()
        ->assertSee('id="sandbox-heroes"', false)
        ->assertSee('"assassin":{"strength":7,"agility":15,"spirit":8}', false);
});

test('the hero, mana and what was learnt are saved and load back', function () {
    $user = User::factory()->create();
    $hero = sandboxHero(['class' => 'mage', 'gender' => 'female', 'level' => 5, 'xp' => 12, 'points' => ['spirit' => 2]]);
    $research = ['points' => 35, 'known' => ['iron_sword', 'staff']];

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero, 'health' => 160, 'mana' => 250, 'research' => $research]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.hero', $hero)
        ->assertJsonPath('data.health', 160)
        ->assertJsonPath('data.mana', 250)
        ->assertJsonPath('data.research', $research);
});

test('a character from before heroes loads without one', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/sandbox/player')
        ->assertJsonPath('data.hero', null)
        ->assertJsonPath('data.mana', null)
        ->assertJsonPath('data.research', null);
});

test('health is checked against the stored hero when the save does not send one', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id, 'hero' => sandboxHero()]);

    $this->actingAs($user, 'sanctum')->putJson('/api/sandbox/player', sandboxSave(['health' => 200]))->assertOk();
    $this->putJson('/api/sandbox/player', sandboxSave(['health' => 231]))->assertUnprocessable()->assertJsonValidationErrors('health');
});

test('an impossible hero or research is refused', function (array $extra, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave($extra))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'an unknown class' => [['hero' => sandboxHero(['class' => 'bard'])], 'hero.class'],
    'an unknown gender' => [['hero' => sandboxHero(['gender' => 'robot'])], 'hero.gender'],
    'level zero' => [['hero' => sandboxHero(['level' => 0])], 'hero.level'],
    'past the top level' => [['hero' => sandboxHero(['level' => 51])], 'hero.level'],
    'experience for another level' => [['hero' => sandboxHero(['xp' => 40])], 'hero.xp'],
    'points not earned yet' => [['hero' => sandboxHero(['level' => 3, 'points' => ['strength' => 2]])], 'hero.points'],
    'an unknown attribute' => [['hero' => sandboxHero(['points' => ['luck' => 0]])], 'hero.points'],
    'more health than strength gives' => [['hero' => sandboxHero(['class' => 'assassin']), 'health' => 121], 'health'],
    'more mana than spirit gives' => [['hero' => sandboxHero(), 'mana' => 121], 'mana'],
    'mana without a hero' => [['mana' => 5], 'mana'],
    'an unknown recipe learnt' => [['research' => ['points' => 0, 'known' => ['laser']]], 'research.known.0'],
    'a recipe learnt twice' => [['research' => ['points' => 0, 'known' => ['staff', 'staff']]], 'research.known.0'],
    'negative knowledge' => [['research' => ['points' => -1, 'known' => []]], 'research.points'],
]);

test('the look of the hero is saved and loads back', function () {
    $user = User::factory()->create();
    $hero = sandboxHero(['look' => ['hair' => 'ponytail', 'hair_color' => 'pink', 'beard' => 'none', 'eyes' => 'violet']]);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.hero.look', $hero['look']);
});

test('a look the game cannot draw is refused', function (array $look, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => sandboxHero(['look' => $look])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'an unknown hairstyle' => [['hair' => 'mohawk', 'hair_color' => 'black', 'beard' => 'none', 'eyes' => 'blue'], 'hero.look.hair'],
    'an unknown hair colour' => [['hair' => 'short', 'hair_color' => 'green', 'beard' => 'none', 'eyes' => 'blue'], 'hero.look.hair_color'],
    'an unknown beard' => [['hair' => 'short', 'hair_color' => 'black', 'beard' => 'braids', 'eyes' => 'blue'], 'hero.look.beard'],
    'an unknown eye colour' => [['hair' => 'short', 'hair_color' => 'black', 'beard' => 'none', 'eyes' => 'red'], 'hero.look.eyes'],
    'a part left out' => [['hair' => 'short', 'hair_color' => 'black', 'beard' => 'none'], 'hero.look.eyes'],
    'something else' => [['hair' => 'short', 'hair_color' => 'black', 'beard' => 'none', 'eyes' => 'blue', 'tattoo' => 'yes'], 'hero.look'],
]);

test('the client draws every look the server accepts', function (string $type, string $part) {
    $client = file_get_contents(app_path('Games/Sandbox/client/player/looks.ts'));
    preg_match("/export type {$type} =([^;]+);/", $client, $match);
    preg_match_all("/'([a-z_]+)'/", $match[1], $names);

    expect($names[1])->toBe(Heroes::looks($part));
})->with([
    ['HairStyle', 'hair'],
    ['HairColor', 'hair_color'],
    ['Beard', 'beard'],
    ['EyeColor', 'eyes'],
]);

test('roofs, stone walls and dug-out sites are saved', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave([
            'placed' => [['type' => 'wood_roof', 'x' => 1, 'z' => 1, 'yaw' => 0], ['type' => 'stone_wall', 'x' => 2, 'z' => 0, 'yaw' => 0]],
            'harvested' => [['id' => 'dig:7', 'at' => 1]],
            'stats' => ['digs' => 1, 'researched' => 2],
        ]))
        ->assertOk()
        ->assertJsonPath('data.placed.0.type', 'wood_roof')
        ->assertJsonPath('data.harvested.0.id', 'dig:7')
        ->assertJsonPath('data.stats.digs', 1);
});

function sandboxArtifact(array $overrides = []): array
{
    return ['type' => 'stats', 'rank' => 1, 'points' => ['strength' => 3, 'agility' => 2], ...$overrides];
}

test('artifacts in the lineage tree add their points, and with them health and mana', function () {
    $tree = [
        sandboxArtifact(),
        null,
        sandboxArtifact(['rank' => 2, 'points' => ['strength' => 2, 'spirit' => 5]]),
    ];
    $hero = sandboxHero(['artifacts' => ['stash' => [], 'tree' => $tree]]);

    // Strength 18 + 3 + 2 = 23 → 50 + 230; spirit 7 + 5 = 12 → 50 + 120.
    expect(Heroes::attributesAt('tank', 'male', 1, [], $tree))->toBe(['strength' => 23, 'agility' => 7, 'spirit' => 12])
        ->and(Heroes::maxHealth($hero))->toBe(280.0)
        ->and(Heroes::maxMana($hero))->toBe(170.0);
});

test('artifacts in the store give nothing until they are put into the tree', function () {
    $hero = sandboxHero(['artifacts' => ['stash' => [sandboxArtifact()], 'tree' => [null, null, null]]]);

    expect(Heroes::maxHealth($hero))->toBe(230.0);
});

test('cells of the lineage tree open with the level', function (int $level, int $cells) {
    expect(Heroes::treeCells($level))->toBe($cells);
})->with([[1, 3], [2, 3], [3, 4], [5, 5], [10, 7], [20, 10], [50, 16]]);

test('stats artifacts grow with the rank, the immortal ones far faster', function () {
    $middle = fn (int $rank, string $type = 'stats'): float => array_sum(config("sandbox.heroes.artifacts.{$type}.{$rank}.points")) / 2;

    expect(config('sandbox.heroes.artifacts.stats.1.points'))->toBe([4, 5])
        ->and(config('sandbox.heroes.artifacts.stats.2.points'))->toBe([7, 8])
        ->and($middle(6) / $middle(5))->toEqualWithDelta(2.5, 0.1)
        ->and(config('sandbox.heroes.artifacts.stats.6.skill'))->toBe([1, 3])
        ->and(config('sandbox.heroes.artifacts.stats.9.skill'))->toBe([8, 8])
        ->and(config('sandbox.heroes.artifacts.skill.9.skill'))->toBe([9, 9])
        ->and($middle(9, 'skill'))->toBe($middle(8));

    foreach (range(2, 9) as $rank) {
        expect($middle($rank))->toBeGreaterThan($middle($rank - 1));
    }
});

test('the store and the tree are saved and load back', function () {
    $user = User::factory()->create();
    $stash = [
        sandboxArtifact(['rank' => 6, 'points' => ['strength' => 30, 'spirit' => 30], 'skill' => ['name' => 'vampirism', 'rank' => 2]]),
        ['type' => 'skill', 'rank' => 3, 'points' => [], 'skill' => ['name' => 'swiftness', 'rank' => 3]],
    ];
    $tree = [sandboxArtifact(), null, ['type' => 'skill', 'rank' => 9, 'points' => ['agility' => 170], 'skill' => ['name' => 'second_wind', 'rank' => 9]]];
    $hero = sandboxHero(['artifacts' => ['stash' => $stash, 'tree' => $tree]]);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero, 'health' => 260]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.hero.artifacts', $hero['artifacts']);

    // Strength 18 + 3 = 21 → at most 260 health.
    $this->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero, 'health' => 261]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('health');
});

test('an artifact the rules do not allow is refused', function (array $artifact) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => sandboxHero(['artifacts' => ['stash' => [$artifact], 'tree' => []]])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('hero.artifacts.stash.0');
})->with([
    'an unknown type' => [sandboxArtifact(['type' => 'weapon'])],
    'rank zero' => [sandboxArtifact(['rank' => 0])],
    'rank ten' => [sandboxArtifact(['rank' => 10])],
    'too many points for its rank' => [sandboxArtifact(['points' => ['strength' => 6]])],
    'too few points for its rank' => [sandboxArtifact(['points' => ['strength' => 3]])],
    'an unknown attribute' => [sandboxArtifact(['points' => ['luck' => 5]])],
    'a skill on a mortal stats artifact' => [sandboxArtifact(['skill' => ['name' => 'vampirism', 'rank' => 1]])],
    'an immortal stats artifact without its skill' => [sandboxArtifact(['rank' => 6, 'points' => ['strength' => 60]])],
    'a skill of the wrong rank' => [['type' => 'skill', 'rank' => 4, 'points' => [], 'skill' => ['name' => 'iron_skin', 'rank' => 5]]],
    'points on a mortal skill artifact' => [['type' => 'skill', 'rank' => 2, 'points' => ['spirit' => 4], 'skill' => ['name' => 'gatherer', 'rank' => 2]]],
    'an unknown skill' => [['type' => 'skill', 'rank' => 1, 'points' => [], 'skill' => ['name' => 'flight', 'rank' => 1]]],
    'something else' => [sandboxArtifact(['glow' => true])],
]);

test('the tree has no more cells than the level opens', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => sandboxHero(['artifacts' => ['stash' => [], 'tree' => [null, null, null, null]]])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('hero.artifacts.tree');
});

test('the store keeps no more than its size', function () {
    $stash = array_fill(0, Heroes::stashSize() + 1, sandboxArtifact());

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => sandboxHero(['artifacts' => ['stash' => $stash, 'tree' => []]])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('hero.artifacts.stash');
});

test('the client knows every skill artifacts give', function () {
    $client = file_get_contents(app_path('Games/Sandbox/client/hero.ts'));
    preg_match('/export type Passive =([^;]+);/', $client, $match);
    preg_match_all("/'([a-z_]+)'/", $match[1], $names);

    expect($names[1])->toBe(Heroes::artifactSkills());

    foreach (config('sandbox.heroes.artifact_skills') as $values) {
        foreach ($values as $perRank) {
            expect($perRank)->toHaveCount(9);
        }
    }
});

test('artifacts picked up count for the score even once they have come back', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['stats' => ['artifacts' => 4]]))
        ->assertOk();

    expect(Player::query()->sole()->score)->toBe(80);
    $this->getJson('/api/sandbox/summary')->assertJsonPath('data.artifacts', 4);
});
