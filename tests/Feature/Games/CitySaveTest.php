<?php

use App\Domain\Identity\Models\User;
use App\Games\CityBuilder\Models\CitySave;
use Illuminate\Support\Facades\Schema;

function cityPayload(array $overrides = []): array
{
    return [
        'revision' => null,
        'epoch' => 1,
        'year' => 1120,
        'population' => 42,
        'score' => 640,
        'state' => ['version' => 1, 'seed' => 7, 'epoch' => 1, 'buildings' => [['id' => 1, 'type' => 'center', 'x' => 23, 'y' => 23]]],
        ...$overrides,
    ];
}

test('guests cannot read or write a city', function () {
    $this->getJson('/api/games/city/save')->assertUnauthorized();
    $this->putJson('/api/games/city/save', cityPayload())->assertUnauthorized();
    $this->getJson('/api/games/progress')->assertUnauthorized();
});

test('a player without a city gets null', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/games/city/save')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('the first save creates the city under the player id and it loads back', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/games/city/save', cityPayload())
        ->assertOk()
        ->assertJsonPath('data.revision', 1);

    $save = CitySave::query()->sole();

    expect($save->user_id)->toBe($user->id)
        ->and($save->population)->toBe(42)
        ->and($save->state['seed'])->toBe(7);

    $this->getJson('/api/games/city/save')
        ->assertOk()
        ->assertJsonPath('data.revision', 1)
        ->assertJsonPath('data.state.buildings.0.type', 'center');
});

test('each save moves the revision forward', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->putJson('/api/games/city/save', cityPayload())->assertOk();

    $this->putJson('/api/games/city/save', cityPayload(['revision' => 1, 'epoch' => 2, 'year' => 1300]))
        ->assertOk()
        ->assertJsonPath('data.revision', 2);

    expect(CitySave::query()->sole())
        ->revision->toBe(2)
        ->epoch->toBe(2);
});

test('a save from a tab that fell behind is refused with the newer city', function () {
    $user = User::factory()->create();

    CitySave::factory()->create(['user_id' => $user->id, 'revision' => 5, 'population' => 99]);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/games/city/save', cityPayload(['revision' => 3]))
        ->assertStatus(409)
        ->assertJsonPath('data.revision', 5);

    expect(CitySave::query()->sole()->population)->toBe(99);
});

test('players only ever see their own city', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    CitySave::factory()->create(['user_id' => $owner->id]);

    $this->actingAs($other, 'sanctum')
        ->getJson('/api/games/city/save')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('saves are validated', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/city/save', cityPayload(['epoch' => 99, 'state' => 'nope']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['epoch', 'state']);
});

test('an oversized save is refused', function () {
    config(['games.max_save_kb' => 1]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/city/save', cityPayload(['state' => ['blob' => str_repeat('x', 2048)]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['state']);
});

test('starting over deletes the city', function () {
    $user = User::factory()->create();

    CitySave::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')->deleteJson('/api/games/city/save')->assertOk();

    expect(CitySave::query()->count())->toBe(0);
});

test('progress shows the city for the games menu', function () {
    $user = User::factory()->create();

    CitySave::factory()->inEpoch(3, 1460, 300)->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/games/progress')
        ->assertOk()
        ->assertJsonPath('data.city.epoch', 3)
        ->assertJsonPath('data.city.year', 1460)
        ->assertJsonPath('data.city.population', 300);
});

test('game tables live in the games database, not the main one', function () {
    expect(Schema::connection('games')->hasTable('city_saves'))->toBeTrue()
        ->and(Schema::hasTable('city_saves'))->toBeFalse()
        ->and((new CitySave)->getConnectionName())->toBe('games');
});
