<?php

use App\Domain\Identity\Models\User;
use App\Games\Epochs\Models\Building;
use App\Games\Epochs\Models\Npc;
use App\Games\Epochs\Models\Tile;
use App\Games\Epochs\Models\World;
use Illuminate\Support\Facades\Schema;

function epochsWorld(array $overrides = []): array
{
    return [
        'seed' => 777,
        'width' => 16,
        'height' => 16,
        'epoch' => 'e1000',
        'epoch_index' => 0,
        'year' => 1000,
        'time' => 72,
        'population' => 6,
        'happiness' => 55,
        'score' => 16,
        'resources' => ['food' => 120, 'wood' => 160, 'stone' => 60, 'gold' => 80, 'tools' => 0],
        'weather' => 'clear',
        'weather_until' => 0,
        'next_event_at' => 200,
        'moods' => [],
        'next_uid' => 3,
        'stats' => ['built' => 0, 'upgraded' => 0, 'demolished' => 0, 'events' => 0],
        ...$overrides,
    ];
}

/**
 * A full 16×16 map, a town centre and one resident.
 */
function epochsCreatePayload(): array
{
    $tiles = [];

    for ($y = 0; $y < 16; $y++) {
        for ($x = 0; $x < 16; $x++) {
            $tiles[] = [$x, $y, 'meadow', 120, $x === 0 ? 'tree' : null];
        }
    }

    return [
        'world' => epochsWorld(),
        'tiles' => $tiles,
        'buildings' => [['uid' => 1, 'type' => 'town_center', 'x' => 7, 'y' => 7, 'level' => 1, 'build_start' => 0, 'build_end' => 0]],
        'npcs' => [['uid' => 2, 'type' => 'peasant', 'name' => 'Алишер Каримов', 'age' => 30, 'home_uid' => 1, 'work_uid' => null, 'x' => 8.5, 'y' => 8.5, 'activity' => 'home', 'offset' => 0.01]],
    ];
}

test('guests cannot touch worlds', function () {
    $this->getJson('/api/games/epochs/world')->assertUnauthorized();
    $this->postJson('/api/games/epochs/world', epochsCreatePayload())->assertUnauthorized();
});

test('a new world is stored table by table: every tile with its coordinates, buildings and residents', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/games/epochs/world', epochsCreatePayload())
        ->assertCreated()
        ->assertJsonPath('data.revision', 1);

    $world = World::query()->sole();

    expect($world->user_id)->toBe($user->id)
        ->and($world->resources['wood'])->toEqual(160)
        ->and(Tile::query()->count())->toBe(256)
        ->and(Tile::query()->where(['x' => 0, 'y' => 5])->value('feature'))->toBe('tree')
        ->and(Building::query()->sole()->type)->toBe('town_center')
        ->and(Npc::query()->sole()->name)->toBe('Алишер Каримов');
});

test('a world loads back exactly as it was created', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/games/epochs/world', epochsCreatePayload())->assertCreated();

    $this->getJson('/api/games/epochs/world')
        ->assertOk()
        ->assertJsonPath('data.world.seed', 777)
        ->assertJsonPath('data.world.epoch', 'e1000')
        ->assertJsonCount(256, 'data.tiles')
        ->assertJsonPath('data.tiles.0', [0, 0, 'meadow', 120, 'tree'])
        ->assertJsonPath('data.buildings.0.type', 'town_center')
        ->assertJsonPath('data.npcs.0.home_uid', 1);
});

test('a second world cannot be created over the first', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/games/epochs/world', epochsCreatePayload())->assertCreated();
    $this->postJson('/api/games/epochs/world', epochsCreatePayload())->assertStatus(409);
});

test('sync applies only the changes and moves the revision on', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/games/epochs/world', epochsCreatePayload())->assertCreated();

    $this->putJson('/api/games/epochs/world', [
        'revision' => 1,
        'world' => epochsWorld(['time' => 500, 'population' => 9, 'next_uid' => 5]),
        'tiles' => [[0, 5, 'meadow', 120, null]],
        'buildings' => [
            'upsert' => [
                ['uid' => 3, 'type' => 'road', 'x' => 6, 'y' => 7, 'level' => 1, 'build_start' => 400, 'build_end' => 400],
                ['uid' => 4, 'type' => 'hut', 'x' => 5, 'y' => 7, 'level' => 2, 'build_start' => 400, 'build_end' => 410],
            ],
            'delete' => [],
        ],
        'npcs' => [],
    ])->assertOk()->assertJsonPath('data.revision', 2);

    $this->putJson('/api/games/epochs/world', [
        'revision' => 2,
        'world' => epochsWorld(['time' => 600]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => [3]],
        'npcs' => [],
    ])->assertOk()->assertJsonPath('data.revision', 3);

    $world = World::query()->sole();

    expect($world->time)->toBe(600)
        ->and(Tile::query()->where(['x' => 0, 'y' => 5])->value('feature'))->toBeNull()
        ->and(Tile::query()->where(['x' => 0, 'y' => 6])->value('feature'))->toBe('tree')
        ->and(Building::query()->orderBy('uid')->pluck('type')->all())->toBe(['town_center', 'hut'])
        ->and(Building::query()->where('uid', 4)->value('level'))->toBe(2)
        ->and(Npc::query()->count())->toBe(0);
});

test('a save from a tab that fell behind is refused', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/games/epochs/world', epochsCreatePayload())->assertCreated();

    $this->putJson('/api/games/epochs/world', [
        'revision' => 7,
        'world' => epochsWorld(['population' => 999]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])->assertStatus(409)->assertJsonPath('data.revision', 1);

    expect(World::query()->sole()->population)->toBe(6);
});

test('buildings must be types that exist in the content files, and tiles must lie on the map', function () {
    $payload = epochsCreatePayload();
    $payload['buildings'][0]['type'] = 'death_star';
    $payload['tiles'][] = [99, 0, 'meadow', 120, null];

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->postJson('/api/games/epochs/world', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['buildings.0.type', 'tiles']);
});

test('players only ever see their own world', function () {
    World::factory()->create(['user_id' => User::factory()->create()->id]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/games/epochs/world')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('starting over removes the world and all its rows', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/games/epochs/world', epochsCreatePayload())->assertCreated();
    $this->deleteJson('/api/games/epochs/world')->assertOk();

    expect(World::query()->count() + Tile::query()->count() + Building::query()->count() + Npc::query()->count())->toBe(0);
});

test('the games menu shows progress in City of Eras', function () {
    $user = User::factory()->create();

    World::factory()->inEpoch('e1500', 1, 1520, 180)->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/games/progress')
        ->assertOk()
        ->assertJsonPath('data.epochs.epoch_index', 1)
        ->assertJsonPath('data.epochs.population', 180);
});

test('world tables live in the games database only', function () {
    foreach (['epochs_worlds', 'epochs_tiles', 'epochs_buildings', 'epochs_npcs'] as $table) {
        expect(Schema::connection('games')->hasTable($table))->toBeTrue()
            ->and(Schema::hasTable($table))->toBeFalse();
    }
});
