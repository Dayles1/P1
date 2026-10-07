<?php

test('every games URL serves the SPA shell', function (string $url) {
    $this->withoutVite()
        ->get($url)
        ->assertOk()
        ->assertSee('id="games-root"', false)
        ->assertSee('data-home-url="'.route('dashboard').'"', false);
})->with(['/games', '/games/city', '/games/anything/else']);

test('the sidebar links to the games with a full page load', function () {
    $html = $this->get('/dashboard')->assertOk()->getContent();

    expect($html)->toContain('href="'.route('games').'"')
        ->and($html)->toMatch('/href="'.preg_quote(route('games'), '/').'"[^>]*data-turbo="false"|data-turbo="false"[^>]*href="'.preg_quote(route('games'), '/').'"/');
});

test('the gamepad icon is in the sprite', function () {
    expect(file_get_contents(resource_path('svg/icons.svg')))->toContain('id="i-gamepad"');
});
