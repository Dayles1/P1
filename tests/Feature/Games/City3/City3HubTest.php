<?php

use App\Domain\Identity\Models\User;
use App\Games\City3\ContentRepository;
use App\Games\City3\Models\Building;
use App\Games\City3\Models\Npc;
use App\Games\City3\Models\Tile;
use App\Games\City3\Models\World;
use App\Games\Community\Models\GamePlaytime;
use App\Games\Epochs\Models\World as EpochsWorld;
use App\Games\Game;

test('guests cannot read the hub\'s summary or leaderboard, or reset progress', function () {
    $this->getJson('/api/city3/summary')->assertUnauthorized();
    $this->getJson('/api/city3/leaderboard')->assertUnauthorized();
    $this->deleteJson('/api/city3/player')->assertUnauthorized();
});

test('the hub card shows how far the player\'s city has come', function () {
    $user = User::factory()->create();

    World::factory()->inEpoch('e1500', 2, 1520, 180)->create(['user_id' => $user->id, 'score' => 4200]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/city3/summary')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.epoch', 'e1500')
        ->assertJsonPath('data.epoch_name', 'Возрождение')
        ->assertJsonPath('data.year', 1520)
        ->assertJsonPath('data.population', 180)
        ->assertJsonPath('data.score', 4200);

    expect(array_keys($response->json('data')))->toBe(['epoch', 'epoch_name', 'year', 'population', 'score', 'played_at'])
        ->and($response->json('data.played_at'))->not->toBeNull();
});

test('a player who never founded a world has no summary', function () {
    $user = User::factory()->create();
    EpochsWorld::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/city3/summary')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('the leaderboard ranks worlds by score, ties sharing a rank, and shows the player their place', function () {
    $user = User::factory()->create(['name' => 'Анна']);
    $leader = User::factory()->create(['name' => 'Борис']);

    World::factory()->inEpoch('e1000', 1, 1100, 40)->create(['user_id' => $leader->id, 'score' => 5000]);
    World::factory()->create(['user_id' => 999_999, 'score' => 3000]);
    $this->travel(1)->minute();
    World::factory()->create(['user_id' => 999_998, 'score' => 3000]);

    foreach (range(1, 20) as $i) {
        World::factory()->create(['score' => 1000 + $i]);
    }

    World::factory()->create(['user_id' => $user->id, 'score' => 50, 'population' => 12]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/city3/leaderboard')->assertOk();

    $response
        ->assertJsonPath('data.game', 'city3')
        ->assertJsonCount(20, 'data.entries')
        ->assertJsonPath('data.entries.0', [
            'rank' => 1,
            'name' => 'Борис',
            'score' => 5000,
            'details' => ['epoch' => 'e1000', 'epoch_name' => (new ContentRepository)->epochName('e1000'), 'year' => 1100, 'population' => 40],
            'is_me' => false,
        ])
        ->assertJsonPath('data.entries.1.rank', 2)
        ->assertJsonPath('data.entries.1.name', null)
        ->assertJsonPath('data.entries.2.rank', 2)
        ->assertJsonPath('data.entries.3.rank', 4)
        ->assertJsonPath('data.entries.3.score', 1020)
        ->assertJsonPath('data.me.rank', 24)
        ->assertJsonPath('data.me.name', 'Анна')
        ->assertJsonPath('data.me.score', 50)
        ->assertJsonPath('data.me.details.population', 12);

    expect($response->json('data.entries.1.score'))->toBe(3000)
        ->and(collect($response->json('data.entries'))->pluck('is_me')->contains(true))->toBeFalse();
});

test('the leaderboard marks the player and shows the era', function () {
    $user = User::factory()->create();

    World::factory()->inEpoch('e1500', 2, 1520, 180)->create(['user_id' => $user->id, 'score' => 900]);
    World::factory()->create(['score' => 100]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/city3/leaderboard')
        ->assertOk()
        ->assertJsonCount(2, 'data.entries')
        ->assertJsonPath('data.entries.0.is_me', true)
        ->assertJsonPath('data.entries.0.details.epoch', 'e1500')
        ->assertJsonPath('data.entries.0.details.epoch_name', 'Возрождение')
        ->assertJsonPath('data.entries.0.details.population', 180)
        ->assertJsonPath('data.me.rank', 1);
});

test('a player without a world has no place on the leaderboard', function () {
    World::factory()->create(['score' => 10]);
    EpochsWorld::factory()->create(['score' => 99_999]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/city3/leaderboard')
        ->assertOk()
        ->assertJsonCount(1, 'data.entries')
        ->assertJsonPath('data.entries.0.score', 10)
        ->assertJsonPath('data.me', null);
});

test('the hub\'s reset wipes the player\'s world and nothing else', function () {
    $user = User::factory()->create();
    $other = World::factory()->create();
    $world = World::factory()->create(['user_id' => $user->id]);
    $world->tiles()->create(['x' => 0, 'y' => 0, 'biome' => 'meadow', 'elevation' => 120, 'feature' => null]);
    $world->buildings()->create(['uid' => 1, 'type' => 'town_center', 'x' => 7, 'y' => 7, 'level' => 1]);
    $world->npcs()->create(['uid' => 2, 'type' => 'peasant', 'name' => 'Алишер', 'age' => 30, 'home_uid' => 1, 'x' => 8, 'y' => 8, 'activity' => 'home', 'offset' => 0]);
    EpochsWorld::factory()->create(['user_id' => $user->id]);
    GamePlaytime::factory()->create(['user_id' => $user->id, 'game' => Game::City3, 'seconds' => 600]);

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/city3/player')
        ->assertOk()
        ->assertJsonPath('success', true);

    expect(World::query()->pluck('id')->all())->toBe([$other->id])
        ->and(Tile::query()->count() + Building::query()->count() + Npc::query()->count())->toBe(0)
        ->and(EpochsWorld::query()->where('user_id', $user->id)->exists())->toBeTrue()
        ->and(GamePlaytime::query()->where('user_id', $user->id)->sole()->seconds)->toBe(600);

    $this->getJson('/api/city3/summary')->assertOk()->assertJsonPath('data', null);
    $this->deleteJson('/api/city3/player')->assertOk();
});

test('the game is timed and rated like any game, but ranked by its own API', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'sanctum');

    foreach (range(1, 6) as $ignored) {
        $this->postJson('/api/games/city3/playtime')->assertOk();
        $this->travel(60)->seconds();
    }

    $this->putJson('/api/games/city3/rating', ['stars' => 5, 'comment' => 'Город растёт'])
        ->assertOk()
        ->assertJsonPath('data.mine.stars', 5);

    $this->getJson('/api/games/ratings')
        ->assertOk()
        ->assertJsonPath('data.city3.count', 1)
        ->assertJsonPath('data.city3.my_seconds', 300)
        ->assertJsonPath('data.city3.can_rate', true);

    expect(GamePlaytime::query()->where('user_id', $user->id)->sole()->game)->toBe(Game::City3);

    $this->getJson('/api/games/city3/leaderboard')->assertNotFound();
    $this->getJson('/api/city3/leaderboard')->assertOk();
});

test('the hub lists the game first, on its own page with its own API', function () {
    $catalog = file_get_contents(resource_path('games/src/hub/catalog.ts'));
    preg_match('/CATALOG: GameEntry\[\] = \[\s*\{(.*?)\}/s', $catalog, $first);

    expect($first[1] ?? '')->toContain("slug: 'city3'")
        ->toContain("href: '/games/city3'")
        ->toContain("api: '/api/city3'")
        ->toContain('path: null')
        ->and(file_get_contents(resource_path('games/src/shared/i18n.ts')))->toContain('Летопись города 3', 'City Chronicle 3', 'Shahar solnomasi 3');
});
