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
 * A full 16×16 map, the town centre where the fixed map has it (x 49–50,
 * rows 19–20) and one resident.
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
        'buildings' => [['uid' => 1, 'type' => 'town_center', 'x' => 49, 'y' => 19, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null]],
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
                ['uid' => 3, 'type' => 'road', 'x' => 48, 'y' => 19, 'level' => 1, 'build_start' => 400, 'build_end' => 400],
                ['uid' => 4, 'type' => 'house', 'x' => 47, 'y' => 19, 'level' => 2, 'build_start' => 400, 'build_end' => 410, 'style' => null, 'district' => null],
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
                ['uid' => 4, 'type' => 'house', 'x' => 47, 'y' => 19, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => ['blueprint' => $blueprint, 'colors' => ['roof' => '#aa3322']], 'district' => null],
                ['uid' => 5, 'type' => 'district_hall', 'x' => 44, 'y' => 10, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => ['name' => 'Заречье', 'policy' => 'historic']],
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
                ['uid' => 4, 'type' => 'house', 'x' => 47, 'y' => 19, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => ['blueprint' => null, 'colors' => ['wall' => 'red; drop table']], 'district' => null],
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

test('a tab that fell behind can keep its own version: a forced save takes its whole city over the newer one', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    // Another tab saves a road (revision 2).
    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'world' => city3World(['time' => 300, 'next_uid' => 4]),
        'tiles' => [],
        'buildings' => [
            'upsert' => [['uid' => 3, 'type' => 'road', 'x' => 48, 'y' => 19, 'level' => 1, 'build_start' => 200, 'build_end' => 200]],
            'delete' => [],
        ],
        'npcs' => [],
    ])->assertOk()->assertJsonPath('data.revision', 2);

    // This tab still thinks it is at revision 1 and has a house instead.
    $mine = [
        'revision' => 1,
        'world' => city3World(['time' => 400, 'population' => 12, 'next_uid' => 5]),
        'tiles' => [],
        'buildings' => [
            'upsert' => [
                ['uid' => 1, 'type' => 'town_center', 'x' => 49, 'y' => 19, 'level' => 1, 'build_start' => 0, 'build_end' => 0],
                ['uid' => 4, 'type' => 'house', 'x' => 47, 'y' => 19, 'level' => 1, 'build_start' => 350, 'build_end' => 360],
            ],
            'delete' => [],
        ],
        'npcs' => [],
    ];

    $this->putJson('/api/city3/world', $mine)->assertStatus(409);

    $this->putJson('/api/city3/world', [...$mine, 'force' => true])
        ->assertOk()
        ->assertJsonPath('data.revision', 3);

    $world = World::query()->sole();

    expect($world->revision)->toBe(3)
        ->and($world->population)->toBe(12)
        ->and(Building::query()->orderBy('uid')->pluck('type', 'uid')->all())->toBe([1 => 'town_center', 4 => 'house']);
});

test('force must be a boolean', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', [
        'revision' => 1,
        'force' => 'yes please',
        'world' => city3World(),
        'tiles' => [],
        'buildings' => ['upsert' => [], 'delete' => []],
        'npcs' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors('force');
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

/**
 * A sync of the given world numbers and building rows on top of a revision.
 *
 * @param  array<string, mixed>  $world
 * @param  list<array<string, mixed>>  $buildings
 * @return array<string, mixed>
 */
function city3Sync(array $world, array $buildings = [], int $revision = 1): array
{
    return [
        'revision' => $revision,
        'world' => city3World($world),
        'tiles' => [],
        'buildings' => ['upsert' => $buildings, 'delete' => []],
        'npcs' => [],
    ];
}

/**
 * The treasury state as the browser sends it.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function city3Economy(array $overrides = []): array
{
    return [
        'policy' => 'normal', 'policyT' => null, 'dense' => false, 'denseT' => null, 'loan' => 0,
        'arrears' => false, 'arrearsYears' => 0, 'chestT' => null, 'h50' => 50, 'bestH50' => 0,
        'flags' => ['tester' => false],
        ...$overrides,
    ];
}

test('prices, mothballing, organic growth and the Chronicle are saved and load back', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->travel(10)->minutes();

    $this->putJson('/api/city3/world', city3Sync([
        'epoch' => 'e1000',
        'epoch_index' => 1,
        'time' => 2000,
        'peak_population' => 9,
        'era_log' => [['era' => 1, 't' => 1900]],
        'economy' => city3Economy(['policy' => 'low', 'policyT' => 1950, 'loan' => 120.5, 'chestT' => 1990, 'h50' => 61.25]),
    ], [
        ['uid' => 4, 'type' => 'farm', 'x' => 45, 'y' => 10, 'level' => 2, 'build_start' => 1990, 'build_end' => 2240, 'style' => null, 'district' => null,
            'paid' => 1203, 'mothballed' => false, 'organic' => 0, 'built_era' => 0, 'from_level' => 1],
        ['uid' => 5, 'type' => 'temple', 'x' => 40, 'y' => 10, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null,
            'paid' => 360, 'mothballed' => true, 'organic' => 0, 'built_era' => 0, 'from_level' => 0],
        ['uid' => 6, 'type' => 'house', 'x' => 47, 'y' => 22, 'level' => 2, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null,
            'paid' => 28, 'mothballed' => false, 'organic' => 0.375, 'built_era' => 1, 'from_level' => 2],
    ]))->assertOk();

    $this->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world.world.era_log', [['era' => 1, 't' => 1900]])
        ->assertJsonPath('data.world.world.peak_population', 9)
        ->assertJsonPath('data.world.world.economy.policy', 'low')
        ->assertJsonPath('data.world.world.economy.loan', 120.5)
        ->assertJsonPath('data.world.world.economy.chestT', 1990)
        ->assertJsonPath('data.world.buildings.1.paid', 1203)
        ->assertJsonPath('data.world.buildings.1.from_level', 1)
        ->assertJsonPath('data.world.buildings.2.mothballed', true)
        ->assertJsonPath('data.world.buildings.3.organic', 0.375)
        ->assertJsonPath('data.world.buildings.3.built_era', 1)
        // Saved before slice 3: nothing recorded, the client credits the list price.
        ->assertJsonPath('data.world.buildings.0.paid', null)
        ->assertJsonPath('data.world.buildings.0.mothballed', false);
});

test('the server works out the year and the score from the era log, never the browser', function () {
    $user = User::factory()->create();
    $homes = [];

    for ($i = 0; $i < 17; $i++) {
        $homes[] = ['uid' => 10 + $i, 'type' => 'house', 'x' => 36 + $i % 16, 'y' => 1 + intdiv($i, 16), 'level' => 5, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null];
    }

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->travel(10)->minutes();

    $this->putJson('/api/city3/world', city3Sync([
        'epoch' => 'e1000',
        'epoch_index' => 1,
        'time' => 74 * 25 + 10,
        'year' => 5,
        'score' => 999_999,
        'peak_population' => 400,
        // Entered the Middle Ages in year 74: two stars (by 76, not by 72), 926 years ahead.
        'era_log' => [['era' => 1, 't' => 74 * 25]],
        'economy' => city3Economy(['h50' => 58, 'bestH50' => 60]),
        'achievements' => ['first_homes', 'never_in_arrears'],
    ], $homes))->assertOk();

    $world = World::query()->sole();

    // Chronicle 1 000 + 926 + 300; City 20 × √400 × (0.8 + 0.4 × 0.6); one achievement.
    expect($world->year)->toBe(74)
        ->and($world->score)->toBe(2226 + 416 + 250)
        ->and($world->stars)->toBe(2)
        ->and($world->lead)->toBe(926)
        ->and($world->peak_population)->toBe(400)
        ->and($world->ranked)->toBeTrue();
});

test('a peak population the stored homes cannot hold is cut to 1.2 times their places', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    $this->putJson('/api/city3/world', city3Sync(['peak_population' => 5000]))->assertOk();

    // Only the chief's tent stands: 8 places.
    expect(World::query()->sole()->peak_population)->toBe(9);
});

test('era logs that do not hold together, unknown treasury keys and bad building fields are refused', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', city3Sync([
        'epoch' => 'e1500',
        'epoch_index' => 2,
        'time' => 4000,
        'era_log' => [['era' => 2, 't' => 100], ['era' => 1, 't' => 200]],
        'economy' => [...city3Economy(['policy' => 'zero']), 'bribe' => 5],
    ], [
        ['uid' => 4, 'type' => 'house', 'x' => 47, 'y' => 19, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null,
            'paid' => -5, 'mothballed' => 'maybe', 'organic' => 3, 'built_era' => 9, 'from_level' => 0],
    ]))->assertUnprocessable()->assertJsonValidationErrors([
        'world.era_log', 'world.economy', 'world.economy.policy',
        'buildings.upsert.0.paid', 'buildings.upsert.0.mothballed', 'buildings.upsert.0.organic', 'buildings.upsert.0.built_era',
    ]);

    $this->putJson('/api/city3/world', city3Sync([
        'epoch' => 'e1000',
        'epoch_index' => 1,
        'time' => 4000,
        'era_log' => [['era' => 1, 't' => 5000]],
    ]))->assertUnprocessable()->assertJsonValidationErrors(['world.era_log']);

    expect(World::query()->sole()->revision)->toBe(1);
});

test('tester saves, time that ran too fast and eras entered impossibly early stay off the leaderboard', function () {
    $tester = User::factory()->create();
    $hasty = User::factory()->create();
    $prodigy = User::factory()->create();

    foreach ([$tester, $hasty, $prodigy] as $user) {
        $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();
    }

    $this->travel(10)->minutes();

    $this->actingAs($tester, 'sanctum')
        ->putJson('/api/city3/world', city3Sync(['time' => 500, 'economy' => city3Economy(['flags' => ['tester' => true]])]))
        ->assertOk();
    // 10 minutes of play at ×5 is 3 000 game seconds at most.
    $this->actingAs($hasty, 'sanctum')
        ->putJson('/api/city3/world', city3Sync(['time' => 20_000]))
        ->assertOk();
    // The Middle Ages in year 10: below 0.6 × the three-star year 72.
    $this->actingAs($prodigy, 'sanctum')
        ->putJson('/api/city3/world', city3Sync(['epoch' => 'e1000', 'epoch_index' => 1, 'time' => 300, 'era_log' => [['era' => 1, 't' => 250]]]))
        ->assertOk();

    expect(World::query()->where('ranked', true)->count())->toBe(0);

    $this->actingAs($prodigy, 'sanctum')
        ->getJson('/api/city3/leaderboard')
        ->assertOk()
        ->assertJsonCount(0, 'data.entries')
        ->assertJsonPath('data.me.rank', null);

    // A later honest save does not wash the flag off.
    $this->travel(10)->minutes();
    $this->actingAs($tester, 'sanctum')
        ->putJson('/api/city3/world', city3Sync(['time' => 600], [], 2))
        ->assertOk();

    expect(World::query()->where('user_id', $tester->id)->value('ranked'))->toBeFalse();
});

/**
 * A building row at a place, level 1, finished.
 *
 * @return array<string, mixed>
 */
function city3Building(int $uid, string $type, int $x, int $y): array
{
    return ['uid' => $uid, 'type' => $type, 'x' => $x, 'y' => $y, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null];
}

test('the land bought is saved, loads back and scores 100 a strip', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $before = World::query()->sole();

    expect($before->land_left)->toBe(0)->and($before->land_right)->toBe(0);

    $this->putJson('/api/city3/world', city3Sync(['land_left' => 2, 'land_right' => 1], [
        // On the rich ore of the first western strip, and a fishery in the deep bay.
        city3Building(4, 'mine', 30, 0),
        city3Building(5, 'fishery', 66, 59),
    ]))->assertOk();

    $this->getJson('/api/city3/world')
        ->assertOk()
        ->assertJsonPath('data.world.world.land_left', 2)
        ->assertJsonPath('data.world.world.land_right', 1)
        ->assertJsonPath('data.world.buildings.1.x', 30);

    expect(World::query()->sole()->score)->toBe($before->score + 300);
});

test('buildings must stand on the land bought, inside their zone', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->postJson('/api/city3/world', city3CreatePayload())->assertCreated();

    $this->putJson('/api/city3/world', city3Sync([], [
        city3Building(4, 'house', 33, 10),      // west of the start, not bought
        city3Building(5, 'house', 40, 45),      // a home on the beach
        city3Building(6, 'mine', 42, 0),        // no ore there
        city3Building(7, 'quarry', 37, 0),      // on the coal spot
        city3Building(8, 'fishery', 40, 58),    // not at the waterline
        city3Building(9, 'storehouse', 50, 47), // on the airport plot
        city3Building(10, 'house', 40, 60),     // in the sea
        city3Building(11, 'quarry', 45, 0),     // over the tunnel portal at x 46
    ]))->assertUnprocessable()->assertJsonValidationErrors([
        'buildings.upsert.0', 'buildings.upsert.1', 'buildings.upsert.2', 'buildings.upsert.3',
        'buildings.upsert.4', 'buildings.upsert.5', 'buildings.upsert.6', 'buildings.upsert.7',
    ]);

    $this->putJson('/api/city3/world', city3Sync(['land_left' => 8, 'land_right' => -1]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['world.land_left', 'world.land_right']);

    $this->putJson('/api/city3/world', city3Sync(['land_left' => 1], [
        city3Building(4, 'house', 33, 10),
        city3Building(5, 'park', 44, 46),
        city3Building(6, 'road', 50, 47),
        city3Building(7, 'quarry', 42, 0),
        city3Building(8, 'coal_mine', 37, 0),
        city3Building(9, 'manor', 40, 57),
        city3Building(10, 'fishery', 40, 59),
        city3Building(11, 'house', 40, 0),
    ]))->assertOk();

    // Land once bought is never given back; a save that does not say keeps it.
    $this->putJson('/api/city3/world', city3Sync(['land_left' => 0], [], 2))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['world.land_left']);
    $this->putJson('/api/city3/world', city3Sync([], [city3Building(12, 'house', 31, 10)], 2))->assertOk();

    expect(World::query()->sole()->land_left)->toBe(1)
        ->and(Building::query()->count())->toBe(10);
});
