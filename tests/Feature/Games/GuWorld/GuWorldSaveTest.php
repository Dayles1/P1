<?php

use App\Domain\Identity\Models\User;
use App\Games\GuWorld\Models\Save;
use Illuminate\Support\Facades\Schema;

test('the game has a page of its own, apart from the games SPA and the Sandbox', function () {
    $this->withoutVite()
        ->get('/games/gu-world')
        ->assertOk()
        ->assertSee('id="gu-world-root"', false)
        ->assertSee('data-back-url="'.url('/games').'"', false)
        ->assertDontSee('id="games-root"', false)
        ->assertDontSee('id="sandbox-root"', false);
});

test('saves live in the GU World database only', function () {
    expect(Schema::connection('gu_world')->hasTable('saves'))->toBeTrue()
        ->and(Schema::hasTable('saves'))->toBeFalse()
        ->and(Schema::connection('sandbox')->hasTable('saves'))->toBeFalse()
        ->and(Schema::connection('games')->hasTable('saves'))->toBeFalse();
});

test('guests cannot load a game', function () {
    $this->getJson('/api/gu-world/save')->assertUnauthorized();
});

test('a new player has no saved game', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/gu-world/save')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('a saved game loads back with its location, time and position', function () {
    $user = User::factory()->create();

    Save::factory()->create([
        'user_id' => $user->id,
        'location' => 'test_valley',
        'world_minutes' => 2 * 1440 + 9 * 60,
        'player' => ['x' => 12.5, 'y' => 3.25, 'z' => -40, 'yaw' => 1.5],
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/gu-world/save')
        ->assertOk()
        ->assertJsonPath('data.version', 1)
        ->assertJsonPath('data.location', 'test_valley')
        ->assertJsonPath('data.world_minutes', 2 * 1440 + 9 * 60)
        ->assertJsonPath('data.player.x', 12.5)
        ->assertJsonPath('data.player.z', -40);
});

test('each player loads only their own game', function () {
    $owner = User::factory()->create();
    Save::factory()->create(['user_id' => $owner->id]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/gu-world/save')
        ->assertOk()
        ->assertJsonPath('data', null);
});
