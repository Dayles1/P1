<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Vite;

test('the game has a page of its own, apart from the games SPA and the other games', function () {
    $this->withoutVite()
        ->get('/games/city3')
        ->assertOk()
        ->assertSee('<title>Летопись города 3</title>', false)
        ->assertSee('id="city3-root"', false)
        ->assertSee('data-back-url="'.url('/games').'"', false)
        ->assertDontSee('id="games-root"', false)
        ->assertDontSee('id="sandbox-root"', false)
        ->assertDontSee('id="gu-world-root"', false);
});

test('the page is named and leads back where the config says', function () {
    config(['city3.back_url' => '/dashboard']);

    expect(route('city3'))->toBe(url('/games/city3'));

    $this->withoutVite()
        ->get(route('city3'))
        ->assertOk()
        ->assertSee('data-back-url="'.url('/dashboard').'"', false);
});

test('the page speaks the player\'s language and fits notched screens', function () {
    $this->withoutVite()
        ->withHeader('X-Locale', 'uz')
        ->get('/games/city3')
        ->assertOk()
        ->assertSee('<html lang="uz">', false)
        ->assertSee('viewport-fit=cover', false);
});

test('the page links its own font, Geologica with the sharpness axis, so it needs no font config from the host', function () {
    $this->withoutVite()
        ->get('/games/city3')
        ->assertOk()
        ->assertSee('https://fonts.googleapis.com/css2?family=Geologica:wght@400..800&display=swap', false)
        ->assertSee('https://fonts.googleapis.com/css2?family=Geologica:wght,SHRP@400..800,0..100&display=swap', false)
        ->assertDontSee('family=Onest', false);

    expect(file_get_contents(base_path('app/Games/City3/views/app.blade.php')))->not->toContain('@fonts');
});

test('the page loads the game\'s own client through Vite, with React fast refresh', function () {
    $hotFile = sys_get_temp_dir().DIRECTORY_SEPARATOR.uniqid('city3-vite-', true).'.hot';
    file_put_contents($hotFile, 'http://localhost:5173');
    Vite::useHotFile($hotFile);

    try {
        $this->get('/games/city3')
            ->assertOk()
            ->assertSee('http://localhost:5173/@react-refresh', false)
            ->assertSee('<script type="module" src="http://localhost:5173/@vite/client"></script>', false)
            ->assertSee('<script type="module" src="http://localhost:5173/app/Games/City3/client/main.tsx"></script>', false)
            ->assertDontSee('resources/games/src/main.tsx', false);
    } finally {
        File::delete($hotFile);
    }
});

test('the page\'s client entry exists and is one of Vite\'s inputs', function () {
    $entry = 'app/Games/City3/client/main.tsx';

    expect(base_path($entry))->toBeFile()
        ->and(file_get_contents(base_path('vite.config.ts')))->toContain("'{$entry}'");
});

test('the games SPA still serves every other /games URL', function () {
    $this->withoutVite()
        ->get('/games/city2')
        ->assertOk()
        ->assertSee('id="games-root"', false)
        ->assertDontSee('id="city3-root"', false);
});

test('world tables live in the game\'s own database only', function () {
    foreach (['worlds', 'tiles', 'buildings', 'npcs'] as $table) {
        expect(Schema::connection('city3')->hasTable($table))->toBeTrue()
            ->and(Schema::hasTable($table))->toBeFalse()
            ->and(Schema::connection('games')->hasTable($table))->toBeFalse()
            ->and(Schema::connection('sandbox')->hasTable($table))->toBeFalse()
            ->and(Schema::connection('gu_world')->hasTable($table))->toBeFalse();
    }

    expect(Schema::connection('city3')->hasTable('epochs_worlds'))->toBeFalse()
        ->and(Schema::connection('games')->hasTable('epochs_worlds'))->toBeTrue();
});

test('the game\'s connection is the main one with only the database swapped', function () {
    $default = config('database.connections.'.config('database.default'));
    $city3 = config('database.connections.city3');

    expect($city3['driver'])->toBe($default['driver'])
        ->and($city3['database'])->toBe(':memory:');
});
