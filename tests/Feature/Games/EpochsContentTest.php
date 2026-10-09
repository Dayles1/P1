<?php

use App\Domain\Identity\Models\User;
use App\Games\Epochs\Content\ContentRepository;
use App\Games\Epochs\Content\ContentValidator;
use Illuminate\Support\Facades\File;

/*
 * Workshop tests write to a throwaway copy of the content files, never to
 * the real ones.
 */
beforeEach(function () {
    $this->contentPath = storage_path('framework/testing/epochs-content-'.uniqid());
    File::copyDirectory(resource_path('games/content/epochs'), $this->contentPath);
    config([
        'games.epochs.content_path' => $this->contentPath,
        'games.workshop.enabled' => true,
        'games.workshop.editors' => [],
    ]);
});

afterEach(function () {
    File::deleteDirectory($this->contentPath);
});

test('the shipped content files are valid', function () {
    $repository = new ContentRepository;

    expect((new ContentValidator)->validate($repository->bundle()))->toBe([])
        ->and($repository->buildingIds())->toContain('town_center', 'house', 'farm', 'road', 'architect_bureau', 'district_hall')
        ->and(array_column($repository->read('epochs')['epochs'], 'year'))->toBe([0, 1000, 1500, 1800, 1900, 2000, 2100, 2300, 2500, 3000]);
});

test('every building has levels with a model, a cost and effects', function () {
    $repository = new ContentRepository;

    foreach ($repository->buildingIds() as $id) {
        $building = $repository->read("buildings/{$id}");

        foreach ($building['levels'] as $level) {
            expect($level)->toHaveKeys(['level', 'name', 'epoch', 'cost', 'buildTime', 'effects', 'model'])
                ->and($level['model'])->toHaveKey('parts');
        }
    }
});

test('the game gets every content file in one request', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/games/epochs/content')
        ->assertOk()
        ->assertJsonPath('data.editable', true)
        ->assertJsonStructure(['data' => ['version', 'content' => ['world', 'resources', 'biomes', 'climate', 'epochs', 'techs', 'blueprints', 'goals', 'npcs', 'sounds', 'buildings' => ['house']]]]);
});

test('empty objects reach the browser as {} so the workshop never rewrites them as []', function () {
    $json = $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/games/epochs/content')
        ->assertOk()
        ->getContent();

    expect($json)->toContain('"produces":{}')
        ->and($json)->not->toContain('"produces":[]');
});

test('the workshop saves a file exactly as edited, keeping the content layout', function () {
    // The browser sends the edited text, with {} kept as {}.
    $text = str_replace('"cost": { "wood": 12 }', '"cost": { "wood": 25 }', file_get_contents($this->contentPath.'/buildings/house.json'));

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/epochs/content/buildings/house', ['json' => $text])
        ->assertOk();

    $written = file_get_contents($this->contentPath.'/buildings/house.json');

    expect(json_decode($written, true)['levels'][0]['cost'])->toBe(['wood' => 25])
        ->and($written)->toContain('"cost": { "wood": 25 }')
        ->and($written)->toContain('"produces": {}');
});

test('the workshop creates a new building file', function () {
    $hut = (new ContentRepository)->read('buildings/house');
    $hut['id'] = 'tea_house';
    $hut['name'] = 'Чайхана';

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/epochs/content/buildings/tea_house', ['json' => json_encode($hut, JSON_UNESCAPED_UNICODE)])
        ->assertOk();

    expect(File::exists($this->contentPath.'/buildings/tea_house.json'))->toBeTrue();
});

test('the workshop refuses settings that do not add up', function () {
    $hut = (new ContentRepository)->read('buildings/house');
    $hut['levels'][0]['epoch'] = 'e9999';
    $hut['levels'][0]['cost'] = ['diamonds' => 5];

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/epochs/content/buildings/house', ['json' => json_encode($hut)])
        ->assertUnprocessable()
        ->assertJsonPath('data.issues.0.file', 'buildings/house');

    expect(json_decode(file_get_contents($this->contentPath.'/buildings/house.json'), true)['levels'][0]['epoch'])->toBe('e0');
});

test('the workshop refuses broken JSON and unknown files', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $this->putJson('/api/games/epochs/content/world', ['json' => '{ nope'])->assertUnprocessable();
    $this->putJson('/api/games/epochs/content/passwords', ['json' => '{}'])->assertNotFound();
});

test('a building still in use cannot be deleted, an unused one can', function () {
    $this->actingAs(User::factory()->create(), 'sanctum');

    $this->deleteJson('/api/games/epochs/content/buildings/market')->assertUnprocessable();
    $this->deleteJson('/api/games/epochs/content/buildings/vertical_farm')->assertOk();

    expect(File::exists($this->contentPath.'/buildings/vertical_farm.json'))->toBeFalse();
});

test('only listed editors may use the workshop', function () {
    $editor = User::factory()->create();
    $player = User::factory()->create();

    config(['games.workshop.editors' => [$editor->id]]);

    $this->actingAs($player, 'sanctum')
        ->putJson('/api/games/epochs/content/world', ['json' => '{}'])
        ->assertForbidden();

    $this->getJson('/api/games/epochs/content')->assertOk()->assertJsonPath('data.editable', false);

    $this->actingAs($editor, 'sanctum')->getJson('/api/games/epochs/content')->assertJsonPath('data.editable', true);
});

test('a disabled workshop is closed to everyone', function () {
    config(['games.workshop.enabled' => false]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->deleteJson('/api/games/epochs/content/buildings/park')
        ->assertForbidden();
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

test('the skyscraper is built from studio designs the workshop can reopen', function () {
    $skyscraper = (new ContentRepository)->read('buildings/skyscraper');

    expect($skyscraper['size'])->toBe(['w' => 2, 'h' => 2])
        ->and($skyscraper['levels'][0]['tech'])->toBe('highrise_engineering');

    foreach ($skyscraper['levels'] as $level) {
        expect($level['model']['parts'])->not->toBeEmpty()
            ->and($level['model']['studio'])->toHaveKeys(['name', 'parts', 'height'])
            ->and($level['model']['studio']['parts'])->not->toBeEmpty();

        foreach ($level['model']['parts'] as $part) {
            if (isset($part['w'], $part['x'])) {
                expect($part['x'])->toBeGreaterThanOrEqual(0)
                    ->and($part['x'] + $part['w'])->toBeLessThanOrEqual(2.01);
            }
        }
    }
});

test('a building level saved with its studio design passes the workshop', function () {
    $skyscraper = (new ContentRepository)->read('buildings/skyscraper');
    $skyscraper['levels'][0]['model']['studio']['height'] = 7;

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/games/epochs/content/buildings/skyscraper', ['json' => json_encode($skyscraper, JSON_UNESCAPED_UNICODE)])
        ->assertOk();

    expect((new ContentRepository)->read('buildings/skyscraper')['levels'][0]['model']['studio']['height'])->toBe(7);
});
