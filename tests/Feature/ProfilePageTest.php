<?php

use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/**
 * The profile page's own markup — everything inside `<main>`, without
 * the shell around it.
 */
function profileContent(TestResponse $response): string
{
    preg_match('/<main class="app-main".*?<\/main>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

test('the profile page renders the hooks its script fills', function () {
    $html = profileContent($this->get('/profile')->assertOk());

    expect($html)->toContain('data-profile-name')
        ->and($html)->toContain('data-profile-avatar')
        ->and($html)->toContain('data-profile-role')
        ->and($html)->toContain('data-profile-meta')
        ->and($html)->toContain('data-profile-groups')
        ->and(substr_count($html, 'data-profile-stat="'))->toBe(3)
        ->and(substr_count($html, 'data-profile-fact="'))->toBe(5);
});

test('the profile page links to editing the profile in settings', function () {
    $html = profileContent($this->get('/profile')->assertOk());

    expect($html)->toContain('href="'.route('settings.profile').'"');
});

test('on a phone the profile page is the way into every settings section and sign-out', function () {
    $html = profileContent($this->get('/profile')->assertOk());

    preg_match('/<nav class="profile-menu".*?<\/nav>/s', $html, $menu);

    expect($menu[0] ?? '')->toContain('href="'.route('settings.security').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('sessions').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('settings.notifications').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('settings.appearance').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('settings.language').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('settings.developer').'"')
        ->and($menu[0] ?? '')->toContain('href="'.route('changelog').'"')
        ->and($menu[0] ?? '')->toContain('data-logout');
});

test('the profile page is translated in every locale', function (string $locale) {
    $html = profileContent($this->withUnencryptedCookie('locale', $locale)->get('/profile')->assertOk());
    $dictionary = require lang_path("{$locale}/ui.php");
    $script = file_get_contents(resource_path('js/blade/app/profile.js'));

    preg_match_all("/\bt\(\s*'((?:profile_page|dashboard|common|nav)\.[a-z0-9_.]+)'/", $script, $keys);

    expect($html)->not->toContain('ui.profile_page.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'profile_page.contacts')));

    foreach (array_unique($keys[1]) as $key) {
        expect(Arr::get($dictionary, $key))->toBeString("{$locale}: {$key} is missing");
    }
})->with(['en', 'ru', 'uz']);
