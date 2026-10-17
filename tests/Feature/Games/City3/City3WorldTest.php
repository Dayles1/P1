<?php

use App\Domain\Identity\Models\User;
use App\Games\City3\ContentRepository;
use App\Games\City3\Models\Building;
use App\Games\City3\Models\Npc;
use App\Games\City3\Models\Tile;
use App\Games\City3\Models\World;
use App\Games\Epochs\Models\World as EpochsWorld;

/**
 * The world's numbers as the browser sends them, with some overridden.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function city3World(array $overrides = []): array
{
    return [
        'seed' => 777,
        'width' => 16,
        'height' => 16,
        'epoch' => 'e0',
        'epoch_index' => 0,
        'year' => 0,
        'time' => 72,
        'population' => 6,
        'happiness' => 55,
        'score' => 16,
        'resources' => ['money' => 1200, 'food' => 160, 'mat' => 160, 'goods' => 0, 'fuel' => 0],
        'weather' => 'clear',
        'weather_until' => 0,
        'next_event_at' => 200,
        'moods' => [],
        'next_uid' => 3,
        'techs' => [],
        'research' => null,
        'blueprints' => [],
        'achievements' => [],
        'stats' => ['built' => 0, 'upgraded' => 0, 'demolished' => 0, 'events' => 0],
        ...$overrides,
    ];
}

/**
 * A full 16×16 map, a town centre and one resident.
 *
 * @return array<string, mixed>
 */
function city3CreatePayload(): array
{
    $tiles = [];

    for ($y = 0; $y < 16; $y++) {
        for ($x = 0; $x < 16; $x++) {
            $tiles[] = [$x, $y, 'meadow', 120, $x === 0 ? 'tree' : null];
        }
    }

    return [
        'world' => city3World(),
        'tiles' => $tiles,
        'buildings' => [['uid' => 1, 'type' => 'town_center', 'x' => 7, 'y' => 7, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null]],
        'npcs' => [['uid' => 2, 'type' => 'peasant', 'name' => 'Алишер Каримов', 'age' => 30, 'home_uid' => 1, 'work_uid' => null, 'x' => 8.5, 'y' => 8.5, 'activity' => 'home', 'offset' => 0.01]],
    ];
}

test('guests cannot touch worlds', function () {
    $this->getJson('/api/city3/world')->assertUnauthorized();
    $this->postJson('/api/city3/world', city3CreatePayload())->assertUnauthorized();
    $this->putJson('/api/city3/world', [])->assertUnauthorized();
    $this->deleteJson('/api/city3/world')->assertUnauthorized();

    expect(World::query()->count())->toBe(0);
});

test('a new player has no world yet', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.world', null)
        ->assertJsonPath('data.tester', false);
});

test('a new world is stored table by table: every tile with its coordinates, buildings and residents', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/city3/world', city3CreatePayload())
        ->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.revision', 1);

    $world = World::query()->sole();

    expect($world->user_id)->toBe($user->id)
        ->and($world->resources['mat'])->toEqual(160)
        ->and(Tile::query()->count())->toBe(256)
        ->and(Tile::query()->where(['x' => 0, 'y' => 5])->value('feature'))->toBe('tree')
        ->and(Building::query()->sole()->type)->toBe('town_center')
        ->and(Npc::query()->sole()->name)->toBe('Алишер Каримов');
});

test('a world loads back exactly as it was created', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world.revision', 1)
        ->assertJsonPath('data.world.world.seed', 777)
        ->assertJsonPath('data.world.world.epoch', 'e0')
        ->assertJsonPath('data.world.world.resources.money', 1200)
        ->assertJsonPath('data.world.world.techs', [])
        ->assertJsonPath('data.world.world.research', null)
        ->assertJsonCount(256, 'data.world.tiles')
        ->assertJsonPath('data.world.tiles.0', [0, 0, 'meadow', 120, 'tree'])
        ->assertJsonPath('data.world.buildings.0.type', 'town_center')
        ->assertJsonPath('data.world.npcs.0.home_uid', 1)
        ->assertJsonPath('data.world.npcs.0.name', 'Алишер Каримов');
});

test('a second world cannot be created over the first', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->withHeader('X-Locale', 'ru')
        ->postJson('/api/city3/world', city3CreatePayload())
        ->assertStatus(409)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Мир уже создан.');

    expect(World::query()->count())->toBe(1);
});

test('sync applies only the changes and moves the revision on', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['time' => 500, 'population' => 9, 'next_uid' => 5]),
        'tiles' => [[0, 5, 'meadow', 120, null]],
        'buildings' => [
            'upsert' => [
                ['uid' => 3, 'type' => 'road', 'x' => 6, 'y' => 7, 'level' => 1, 'build_start' => 400, 'build_end' => 400],
                ['uid' => 4, 'type' => 'house', 'x' => 5, 'y' => 7, 'level' => 2, 'build_start' => 400, 'build_end' => 410, 'style' => null, 'district' => null],
            ],
            'delete' => [],
        ],
        'npcs' => [],
    ])->assertOk()->assertJsonPath('data.revision', 2);

    $this->putJson('/api/city3/world', [
        'revision' => 2,
        'world' => city3World(['time' => 600]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => [3]],
        'npcs' => [],
    ])->assertOk()->assertJsonPath('data.revision', 3);

    $world = World::query()->sole();

    expect($world->time)->toBe(600)
        ->and($world->revision)->toBe(3)
        ->and(Tile::query()->where(['x' => 0, 'y' => 5])->value('feature'))->toBeNull()
        ->and(Tile::query()->where(['x' => 0, 'y' => 6])->value('feature'))->toBe('tree')
        ->and(Building::query()->orderBy('uid')->pluck('type')->all())->toBe(['town_center', 'house'])
        ->and(Building::query()->where('uid', 4)->value('level'))->toBe(2)
        ->and(Npc::query()->count())->toBe(0);
});

test('research, blueprints, goals, building styles and districts are saved and load back', function () {
    $user = User::factory()->create();
    $content = new ContentRepository;
    [$tech, $next] = $content->techIds();
    $blueprint = $content->blueprintIds()[0];
    $goal = $content->goalIds()[0];

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World([
            'techs' => [$tech],
            'research' => ['id' => $next, 'start' => 100, 'end' => 160],
            'blueprints' => [$blueprint],
            'achievements' => [$goal],
        ]),
        'tiles' => [],
        'buildings' => [
            'upsert' => [
                ['uid' => 4, 'type' => 'house', 'x' => 5, 'y' => 7, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => ['blueprint' => $blueprint, 'colors' => ['roof' => '#aa3322']], 'district' => null],
                ['uid' => 5, 'type' => 'district_hall', 'x' => 2, 'y' => 2, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => ['name' => 'Заречье', 'policy' => 'historic']],
            ],
            'delete' => [],
        ],
        'npcs' => [],
    ])->assertOk();

    $this->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world.world.techs', [$tech])
        ->assertJsonPath('data.world.world.research.id', $next)
        ->assertJsonPath('data.world.world.blueprints', [$blueprint])
        ->assertJsonPath('data.world.world.achievements', [$goal])
        ->assertJsonPath('data.world.buildings.1.style.colors.roof', '#aa3322')
        ->assertJsonPath('data.world.buildings.2.district.name', 'Заречье');
});

test('unknown technologies and bad colours are refused', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['techs' => ['time_travel']]),
        'tiles' => [],
        'buildings' => [
            'upsert' => [
                ['uid' => 4, 'type' => 'house', 'x' => 5, 'y' => 7, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => ['blueprint' => null, 'colors' => ['wall' => 'red; drop table']], 'district' => null],
            ],
            'delete' => [],
        ],
        'npcs' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors(['world.techs.0', 'buildings.upsert.0.style.colors.wall']);

    expect(World::query()->sole()->revision)->toBe(1);
});

test('eras, blueprints and goals must exist in the content files', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['epoch' => 'e9999', 'blueprints' => ['moon_base'], 'achievements' => ['conquer_mars']]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors(['world.epoch', 'world.blueprints.0', 'world.achievements.0']);
});

test('a world keeps only the content\'s resources: one currency, no gold or wood', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['resources' => ['money' => 100, 'gold' => 80, 'wood' => 5]]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors(['world.resources']);

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['resources' => ['money' => 100, 'food' => 5], 'achievements' => ['first_homes', 'chronicler']]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])->assertOk();
});

test('a save from a tab that fell behind is refused', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->withHeader('X-Locale', 'ru')->putJson('/api/city3/world', [
        'revision' => 7,
        'world' => city3World(['population' => 999]),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])
        ->assertStatus(409)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Игра сохранена в другой вкладке. Загрузите её заново, чтобы не потерять прогресс.')
        ->assertJsonPath('data.revision', 1);

    expect(World::query()->sole()->population)->toBe(6);
});

test('changes cannot be saved before the world is created', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/city3/world', [
            'revision' => 1,
            'world' => city3World(),
            'tiles' => [],
            'buildings' => ['upsert' => [], 'delete' => []],
            'npcs' => [],
        ])
        ->assertNotFound()
        ->assertJsonPath('success', false);

    expect(World::query()->count())->toBe(0);
});

test('a player cannot sync changes into someone else\'s world', function () {
    $owner = User::factory()->create();

    $this->actingAs($owner, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/city3/world', [
            'revision' => 1,
            'world' => city3World(['population' => 999]),
            'tiles' => [],
            'buildings' => ['upsert' => [], 'delete' => []],
            'npcs' => [],
        ])
        ->assertNotFound()
        ->assertJsonPath('success', false);

    $world = World::query()->sole();

    expect($world->user_id)->toBe($owner->id)
        ->and($world->revision)->toBe(1)
        ->and($world->population)->toBe(6);
});

test('buildings must be types that exist in the content files, and tiles must lie on the map', function () {
    $payload = city3CreatePayload();
    $payload['buildings'][0]['type'] = 'death_star';
    $payload['tiles'][] = [99, 0, 'meadow', 120, null];

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->postJson('/api/city3/world', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['buildings.0.type', 'tiles']);

    expect(World::query()->count())->toBe(0);
});

test('players only ever see their own world', function () {
    World::factory()->create(['user_id' => User::factory()->create()->id]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world', null);
});

test('starting over removes the world and all its rows', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->deleteJson('/api/city3/world')->assertOk()->assertJsonPath('success', true);

    expect(World::query()->count() + Tile::query()->count() + Building::query()->count() + Npc::query()->count())->toBe(0);

    $this->getJson('/api/city3/world')->assertOk()->assertJsonPath('data.world', null);
});

test('starting over removes only the player\'s own world', function () {
    $owner = User::factory()->create();

    $this->actingAs($owner, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->actingAs(User::factory()->create(), 'sanctum')->deleteJson('/api/city3/world')->assertOk();

    expect(World::query()->where('user_id', $owner->id)->exists())->toBeTrue()
        ->and(Tile::query()->count())->toBe(256);
});

test('the game keeps its worlds apart from Летопись города 2', function () {
    $user = User::factory()->create();
    EpochsWorld::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world', null);

    $this->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->deleteJson('/api/city3/world')->assertOk();

    expect(EpochsWorld::query()->where('user_id', $user->id)->exists())->toBeTrue();
});

test('the tester tools are off unless the config turns them on', function () {
    $user = User::factory()->create();
    $this->actingAs($user, 'sanctum');

    config(['city3.testers' => ['enabled' => false, 'ids' => []]]);
    $this->getJson('/api/city3/world')->assertOk()->assertJsonPath('data.tester', false);

    config(['city3.testers' => ['enabled' => true, 'ids' => []]]);
    $this->getJson('/api/city3/world')->assertOk()->assertJsonPath('data.tester', true);
});

test('with tester ids listed, only those players get the tester tools', function () {
    $tester = User::factory()->create();
    $player = User::factory()->create();

    config(['city3.testers' => ['enabled' => true, 'ids' => [$tester->id]]]);

    $this->actingAs($tester, 'sanctum')->getJson('/api/city3/world')->assertJsonPath('data.tester', true);
    $this->actingAs($player, 'sanctum')->getJson('/api/city3/world')->assertJsonPath('data.tester', false);

    config(['city3.testers' => ['enabled' => false, 'ids' => [$tester->id]]]);

    $this->actingAs($tester, 'sanctum')->getJson('/api/city3/world')->assertJsonPath('data.tester', false);
});

test('creating a world is limited to 10 times a minute', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    for ($i = 0; $i < 10; $i++) {
        $this->postJson('/api/city3/world', [])->assertUnprocessable();
    }

    $this->postJson('/api/city3/world', [])->assertTooManyRequests();
});

test('syncing changes is limited to 60 times a minute', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    for ($i = 0; $i < 60; $i++) {
        $this->putJson('/api/city3/world', [])->assertUnprocessable();
    }

    $this->putJson('/api/city3/world', [])->assertTooManyRequests();
});

test('autosaves do not use up the limits on creating a world or on the playtime beat', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    for ($i = 0; $i < 10; $i++) {
        $this->putJson('/api/city3/world', [])->assertUnprocessable();
    }

    $this->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->postJson('/api/games/city3/playtime')->assertOk();
});
