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

test('absorbed artifacts add their attributes, health and mana', function () {
    $hero = sandboxHero(['absorbed' => ['strength_rune' => 2, 'vital_shard' => 3, 'mana_pearl' => 1, 'storm_eye' => 1]]);

    // Strength 18 + 2×2 runes = 22 → 50 + 220, plus 3 shards × 20.
    expect(Heroes::attributesAt('tank', 'male', 1, [], $hero['absorbed'])['strength'])->toBe(22)
        ->and(Heroes::maxHealth($hero))->toBe(330.0)
        ->and(Heroes::maxMana($hero))->toBe(140.0);
});

test('a hero with absorbed artifacts is saved and its health checked against them', function () {
    $user = User::factory()->create();
    $hero = sandboxHero(['absorbed' => ['vital_shard' => 5, 'golden_clover' => 1]]);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero, 'health' => 330]))
        ->assertOk()
        ->assertJsonPath('data.hero.absorbed', ['vital_shard' => 5, 'golden_clover' => 1]);

    $this->putJson('/api/sandbox/player', sandboxSave(['hero' => $hero, 'health' => 331]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('health');
});

test('an artifact absorbed too often, or one that does not exist, is refused', function (array $absorbed, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['hero' => sandboxHero(['absorbed' => $absorbed])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'six runes' => [['strength_rune' => 6], 'hero.absorbed.strength_rune'],
    'a legendary twice' => [['phoenix_feather' => 2], 'hero.absorbed.phoenix_feather'],
    'zero times' => [['mana_pearl' => 0], 'hero.absorbed.mana_pearl'],
    'an unknown artifact' => [['dragon_egg' => 1], 'hero.absorbed'],
]);

test('every client artifact has absorb rules on the server', function () {
    $client = file_get_contents(app_path('Games/Sandbox/client/items.ts'));
    preg_match('/export type ArtifactId =([^;]+);/', $client, $match);
    preg_match_all("/'([a-z_]+)'/", $match[1], $ids);

    expect(collect(Heroes::artifacts())->sort()->values()->all())
        ->toBe(collect($ids[1])->sort()->values()->all());
});

test('artifacts picked up count for the score even once they have come back', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxSave(['stats' => ['artifacts' => 4]]))
        ->assertOk();

    expect(Player::query()->sole()->score)->toBe(80);
    $this->getJson('/api/sandbox/summary')->assertJsonPath('data.artifacts', 4);
});
