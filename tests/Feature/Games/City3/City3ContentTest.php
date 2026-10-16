<?php

use App\Domain\Identity\Models\User;
use App\Games\City3\ContentRepository;
use App\Games\City3\Models\World;
use App\Games\City3\WorldStore;
use Illuminate\Support\Facades\File;

test('the game reads its content from its own folder', function () {
    $repository = new ContentRepository;

    expect(realpath($repository->path()))->toBe(realpath(app_path('Games/City3/content')))
        ->and(File::isDirectory($repository->path('buildings')))->toBeTrue();
});

test('the shipped content files are all there and their ids hold together', function () {
    $repository = new ContentRepository;

    foreach (['world', 'resources', 'biomes', 'climate', 'epochs', 'techs', 'blueprints', 'goals', 'npcs', 'sounds'] as $file) {
        expect($repository->read($file))->not->toBeEmpty();
    }

    $epochs = $repository->epochIds();
    $techs = $repository->techIds();
    $buildings = $repository->buildingIds();
    $resources = array_column($repository->read('resources')['resources'], 'id');
    $world = $repository->read('world');
    $roles = [];

    expect($buildings)->toContain('town_center', 'house', 'farm', 'road', 'architect_bureau', 'district_hall')
        ->and(array_column($repository->read('epochs')['epochs'], 'year'))->toBe([0, 1000, 1500, 1800, 1900, 2000, 2100, 2300, 2500, 3000])
        ->and($epochs)->toContain($world['start']['epoch'])
        ->and($techs)->not->toBeEmpty()
        ->and($repository->blueprintIds())->not->toBeEmpty()
        ->and($repository->goalIds())->not->toBeEmpty();

    foreach ($world['start']['buildings'] as $start) {
        expect($buildings)->toContain($start['type']);
    }

    foreach (array_keys($world['start']['resources']) as $resource) {
        expect($resources)->toContain($resource);
    }

    foreach ($buildings as $id) {
        $building = $repository->read("buildings/{$id}");

        expect($building['id'])->toBe($id);

        if (isset($building['role'])) {
            expect($roles)->not->toHaveKey($building['role']);
            $roles[$building['role']] = $id;
        }

        foreach ($building['levels'] as $level) {
            expect($epochs)->toContain($level['epoch']);

            if (isset($level['tech'])) {
                expect($techs)->toContain($level['tech']);
            }

            foreach (array_keys($level['cost']) as $resource) {
                expect($resources)->toContain($resource);
            }
        }
    }

    expect($roles)->toHaveKeys(['road', 'center']);
});

test('every building has levels with a model, a cost and effects', function () {
    $repository = new ContentRepository;

    foreach ($repository->buildingIds() as $id) {
        $building = $repository->read("buildings/{$id}");

        expect($building['levels'])->not->toBeEmpty();

        foreach ($building['levels'] as $level) {
            expect($level)->toHaveKeys(['level', 'name', 'epoch', 'cost', 'buildTime', 'effects', 'model'])
                ->and($level['model'])->toHaveKey('parts');
        }
    }
});

test('every building model is made of parts the renderer knows', function () {
    $kinds = [
        'box', 'roof', 'floors', 'windows', 'door', 'beams', 'ground', 'field', 'cylinder', 'sphere', 'torus',
        'flag', 'pole', 'emitter', 'light', 'tree', 'blades', 'tower', 'prism', 'crown', 'columns', 'arches',
        'balconies', 'pilasters', 'cornice', 'crenels', 'dormers', 'awning', 'stairs', 'fence', 'solar',
        'chimney', 'helipad', 'neon', 'clock',
    ];
    $repository = new ContentRepository;
    $used = [];

    foreach ($repository->buildingIds() as $id) {
        foreach ($repository->read("buildings/{$id}")['levels'] as $level) {
            foreach ($level['model']['parts'] as $part) {
                expect($kinds)->toContain($part['kind']);
                $used[$part['kind']] = true;
            }
        }
    }

    expect(array_keys($used))->toContain('tower', 'columns', 'dormers', 'balconies', 'neon');
});

test('every home model stands inside its plot', function () {
    $repository = new ContentRepository;

    foreach (['house', 'block', 'manor', 'skyscraper'] as $id) {
        $building = $repository->read("buildings/{$id}");
        $size = $building['size'];

        foreach ($building['levels'] as $level) {
            expect($level['model']['parts'])->not->toBeEmpty();

            foreach ($level['model']['parts'] as $part) {
                if (isset($part['w'], $part['x']) && $part['kind'] !== 'cylinder') {
                    expect($part['x'])->toBeGreaterThanOrEqual(0)
                        ->and($part['x'] + $part['w'])->toBeLessThanOrEqual($size['w'] + 0.011);
                }

                if (isset($part['d'], $part['y'])) {
                    expect($part['y'])->toBeGreaterThanOrEqual(0)
                        ->and($part['y'] + $part['d'])->toBeLessThanOrEqual($size['h'] + 0.011);
                }
            }
        }
    }

    expect($repository->read('buildings/skyscraper')['levels'][0]['tech'])->toBe('highrise_engineering');
});

test('the hub reads era names from the content files', function () {
    $repository = new ContentRepository;

    expect($repository->epochName('e1500'))->toBe('Возрождение')
        ->and($repository->epochName('e9999'))->toBeNull();
});

test('a missing or broken content file reads as empty', function () {
    $path = storage_path('framework/testing/city3-content-'.uniqid());
    File::ensureDirectoryExists($path.'/buildings');
    File::put($path.'/epochs.json', '{ nope');
    config(['city3.content_path' => $path]);

    try {
        $repository = new ContentRepository;

        expect($repository->read('epochs'))->toBe([])
            ->and($repository->read('techs'))->toBe([])
            ->and($repository->epochIds())->toBe([])
            ->and($repository->buildingIds())->toBe([]);
    } finally {
        File::deleteDirectory($path);
    }
});

test('saved worlds are checked against the game\'s own content files', function () {
    $path = storage_path('framework/testing/city3-content-'.uniqid());
    File::copyDirectory(app_path('Games/City3/content'), $path);
    $teaHouse = json_decode(File::get($path.'/buildings/house.json'), true);
    $teaHouse['id'] = 'tea_house';
    File::put($path.'/buildings/tea_house.json', json_encode($teaHouse, JSON_UNESCAPED_UNICODE));
    config(['city3.content_path' => $path]);

    try {
        $user = User::factory()->create();
        $world = World::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/city3/world', [
                'revision' => 1,
                'world' => (new WorldStore)->worldPayload($world),
                'tiles' => [],
                'buildings' => [
                    'upsert' => [['uid' => 3, 'type' => 'tea_house', 'x' => 2, 'y' => 2, 'level' => 1, 'build_start' => 0, 'build_end' => 0, 'style' => null, 'district' => null]],
                    'delete' => [],
                ],
                'npcs' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 2);

        expect($world->buildings()->where('type', 'tea_house')->exists())->toBeTrue()
            ->and(File::exists(resource_path('games/content/epochs/buildings/tea_house.json')))->toBeFalse();
    } finally {
        File::deleteDirectory($path);
    }
});
