<?php

use App\Domain\Identity\Models\User;
use App\Games\CityBuilder\Models\CitySave;
use App\Games\Community\Models\GamePlaytime;
use App\Games\Community\Models\GameRating;
use App\Games\Epochs\Models\World;
use App\Games\Game;

beforeEach(function () {
    $this->withHeader('X-Locale', 'ru');
});

test('guests cannot reach playtime, ratings or leaderboards', function () {
    $this->postJson('/api/games/city/playtime')->assertUnauthorized();
    $this->getJson('/api/games/ratings')->assertUnauthorized();
    $this->putJson('/api/games/city/rating', ['stars' => 5])->assertUnauthorized();
    $this->deleteJson('/api/games/city/rating')->assertUnauthorized();
    $this->getJson('/api/games/city/leaderboard')->assertUnauthorized();
});

test('unknown games are not found', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $this->postJson('/api/games/dice/playtime')->assertNotFound();
    $this->putJson('/api/games/dice/rating', ['stars' => 5])->assertNotFound();
    $this->deleteJson('/api/games/dice/rating')->assertNotFound();
    $this->getJson('/api/games/dice/leaderboard')->assertNotFound();
});

test('the first heartbeat adds nothing and later ones add the time since the previous', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'sanctum');

    $this->postJson('/api/games/city/playtime')->assertOk()->assertJsonPath('data.seconds', 0);

    $this->travel(45)->seconds();
    $this->postJson('/api/games/city/playtime')->assertOk()->assertJsonPath('data.seconds', 45);

    expect(GamePlaytime::query()->where('user_id', $user->id)->sole()->game)->toBe(Game::City);
});

test('a heartbeat adds at most a minute and nothing after a long gap', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $this->postJson('/api/games/epochs/playtime')->assertOk();

    $this->travel(100)->seconds();
    $this->postJson('/api/games/epochs/playtime')->assertJsonPath('data.seconds', 60);

    $this->travel(10)->minutes();
    $this->postJson('/api/games/epochs/playtime')->assertJsonPath('data.seconds', 60);

    $this->travel(30)->seconds();
    $this->postJson('/api/games/epochs/playtime')->assertJsonPath('data.seconds', 90);
});

test('rapid heartbeats cannot inflate play time', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/games/city/playtime')->assertOk();
    }

    expect(GamePlaytime::query()->sole()->seconds)->toBe(0);
});

test('a game can be rated only after five minutes of play', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'sanctum');

    $this->putJson('/api/games/city/rating', ['stars' => 5])
        ->assertForbidden()
        ->assertJsonPath('message', 'Оценить игру можно, когда вы сыграете в неё хотя бы 5 минут.');

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/games/city/playtime')->assertOk();
        $this->travel(60)->seconds();
    }

    $this->putJson('/api/games/city/rating', ['stars' => 4])->assertForbidden();

    $this->postJson('/api/games/city/playtime')->assertJsonPath('data.seconds', 300)->assertJsonPath('data.can_rate', true);

    $this->putJson('/api/games/city/rating', ['stars' => 4, 'comment' => '  Отличная игра  '])
        ->assertOk()
        ->assertJsonPath('data.count', 1)
        ->assertJsonPath('data.mine.stars', 4)
        ->assertJsonPath('data.mine.comment', 'Отличная игра');

    $this->putJson('/api/games/city/rating', ['stars' => 2, 'comment' => ''])
        ->assertOk()
        ->assertJsonPath('data.mine', ['stars' => 2, 'comment' => null]);

    expect(GameRating::query()->count())->toBe(1);

    $this->putJson('/api/games/epochs/rating', ['stars' => 5])->assertForbidden();
});

test('ratings are validated', function (array $payload, string $field) {
    $user = User::factory()->create();
    GamePlaytime::factory()->canRate()->create(['user_id' => $user->id, 'game' => Game::City]);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/games/city/rating', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no stars' => [[], 'stars'],
    'zero stars' => [['stars' => 0], 'stars'],
    'six stars' => [['stars' => 6], 'stars'],
    'fractional stars' => [['stars' => 3.5], 'stars'],
    'long comment' => [['stars' => 3, 'comment' => str_repeat('а', 501)], 'comment'],
]);

test('a player can remove their rating', function () {
    $user = User::factory()->create();
    GameRating::factory()->create(['user_id' => $user->id, 'game' => Game::City, 'stars' => 3]);
    GameRating::factory()->create(['game' => Game::City]);

    $this->actingAs($user, 'sanctum')
        ->deleteJson('/api/games/city/rating')
        ->assertOk()
        ->assertJsonPath('data.mine', null)
        ->assertJsonPath('data.count', 1);

    expect(GameRating::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

test('the summary sums up every playable game', function () {
    $user = User::factory()->create(['name' => 'Анна']);
    $other = User::factory()->create(['name' => 'Борис']);

    GamePlaytime::factory()->create(['user_id' => $user->id, 'game' => Game::City, 'seconds' => 120]);
    GameRating::factory()->create(['user_id' => $user->id, 'game' => Game::City, 'stars' => 5, 'comment' => null]);
    GameRating::factory()->create(['user_id' => $other->id, 'game' => Game::City, 'stars' => 4, 'comment' => 'Неплохо']);
    GameRating::factory()->create(['user_id' => 999_999, 'game' => Game::City, 'stars' => 4, 'comment' => 'Хорошо']);
    $this->travel(1)->minute();
    GameRating::factory()->create(['user_id' => 999_998, 'game' => Game::City, 'stars' => 1, 'comment' => 'Скучно']);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/games/ratings')->assertOk();

    $response
        ->assertJsonPath('data.city.average', 3.5)
        ->assertJsonPath('data.city.count', 4)
        ->assertJsonPath('data.city.distribution', ['1' => 1, '2' => 0, '3' => 0, '4' => 2, '5' => 1])
        ->assertJsonPath('data.city.mine', ['stars' => 5, 'comment' => null])
        ->assertJsonPath('data.city.my_seconds', 120)
        ->assertJsonPath('data.city.can_rate', false)
        ->assertJsonCount(3, 'data.city.recent')
        ->assertJsonPath('data.city.recent.0.comment', 'Скучно')
        ->assertJsonPath('data.city.recent.0.name', 'Игрок #999998')
        ->assertJsonPath('data.epochs.average', null)
        ->assertJsonPath('data.epochs.count', 0)
        ->assertJsonPath('data.epochs.mine', null)
        ->assertJsonPath('data.epochs.recent', []);

    expect(collect($response->json('data.city.recent'))->pluck('name')->all())->toContain('Борис');
});

test('the leaderboard ranks players by score, ties sharing a rank, and shows the player their place', function () {
    $user = User::factory()->create(['name' => 'Анна']);
    $leader = User::factory()->create(['name' => 'Борис']);

    CitySave::factory()->create(['user_id' => $leader->id, 'score' => 5000]);
    CitySave::factory()->create(['user_id' => 999_999, 'score' => 3000]);
    $this->travel(1)->minute();
    CitySave::factory()->create(['user_id' => 999_998, 'score' => 3000]);

    foreach (range(1, 20) as $i) {
        CitySave::factory()->create(['score' => 1000 + $i]);
    }

    CitySave::factory()->create(['user_id' => $user->id, 'score' => 50, 'population' => 12]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/games/city/leaderboard')->assertOk();

    $response
        ->assertJsonCount(20, 'data.entries')
        ->assertJsonPath('data.entries.0', [
            'rank' => 1,
            'name' => 'Борис',
            'score' => 5000,
            'details' => ['epoch' => 0, 'year' => 1000, 'population' => 6],
            'is_me' => false,
        ])
        ->assertJsonPath('data.entries.1.rank', 2)
        ->assertJsonPath('data.entries.1.name', 'Игрок #999999')
        ->assertJsonPath('data.entries.2.rank', 2)
        ->assertJsonPath('data.entries.2.name', 'Игрок #999998')
        ->assertJsonPath('data.entries.3.rank', 4)
        ->assertJsonPath('data.entries.3.score', 1020)
        ->assertJsonPath('data.me.rank', 24)
        ->assertJsonPath('data.me.name', 'Анна')
        ->assertJsonPath('data.me.score', 50)
        ->assertJsonPath('data.me.details.population', 12);

    expect(collect($response->json('data.entries'))->pluck('is_me')->contains(true))->toBeFalse();
});

test('the epochs leaderboard shows the epoch and marks the player', function () {
    $user = User::factory()->create();

    World::factory()->inEpoch('e1', 1, 200, 40)->create(['user_id' => $user->id, 'score' => 900]);
    World::factory()->create(['score' => 100]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/games/epochs/leaderboard')
        ->assertOk()
        ->assertJsonCount(2, 'data.entries')
        ->assertJsonPath('data.entries.0.is_me', true)
        ->assertJsonPath('data.entries.0.details.epoch', 'e1')
        ->assertJsonPath('data.entries.0.details.population', 40)
        ->assertJsonPath('data.me.rank', 1);
});

test('a player without a save has no place on the leaderboard', function () {
    CitySave::factory()->create(['score' => 10]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/games/city/leaderboard')
        ->assertOk()
        ->assertJsonCount(1, 'data.entries')
        ->assertJsonPath('data.me', null);
});

test('the sandbox is timed and rated like any game, but has no leaderboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'sanctum');

    foreach (range(1, 6) as $ignored) {
        $this->postJson('/api/games/sandbox/playtime')->assertOk();
        $this->travel(60)->seconds();
    }

    $this->putJson('/api/games/sandbox/rating', ['stars' => 5, 'comment' => 'Классно строить дом'])
        ->assertOk()
        ->assertJsonPath('data.mine.stars', 5);

    $this->getJson('/api/games/ratings')
        ->assertOk()
        ->assertJsonPath('data.sandbox.count', 1)
        ->assertJsonPath('data.sandbox.can_rate', true);

    $this->getJson('/api/games/sandbox/leaderboard')->assertNotFound();
});

test('every catalog game the hub can rate is known to the server', function () {
    $catalog = file_get_contents(resource_path('games/src/hub/catalog.ts'));
    preg_match_all("/slug: '([a-z0-9]+)',[^}]*?(?:path: '|href: ')/s", $catalog, $playable);

    expect(collect($playable[1])->sort()->values()->all())
        ->toBe(collect(Game::cases())->pluck('value')->sort()->values()->all());
});
