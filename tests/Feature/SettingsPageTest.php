<?php

use App\Http\Controllers\Web\Blade\SettingsPageController;
use Illuminate\Testing\TestResponse;

/**
 * The settings sidebar on its own. The page sits inside the app shell,
 * whose own sidebar and user menu also link into settings, so asserting
 * against the whole document would not say anything about this nav.
 */
function settingsNav(TestResponse $response): string
{
    preg_match('/<nav\s+class="settings-nav".*?<\/nav>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

function settingsRoutes(TestResponse $response): array
{
    preg_match('/data-settings-routes="([^"]*)"/', $response->getContent(), $matches);

    return json_decode(html_entity_decode($matches[1] ?? ''), true) ?? [];
}

test('every personal settings section is its own route', function (string $segment) {
    $this->get("/settings/{$segment}")
        ->assertOk()
        ->assertSee('data-settings-section="'.SettingsPageController::PERSONAL[$segment].'"', false);
})->with(array_keys(SettingsPageController::PERSONAL));

test('every application settings section is its own route', function (string $segment) {
    $this->get("/admin/settings/{$segment}")
        ->assertOk()
        ->assertSee('data-settings-section="'.SettingsPageController::APPLICATION[$segment].'"', false);
})->with(array_keys(SettingsPageController::APPLICATION));

test('each group has an index that names no section of its own', function (string $url) {
    $this->get($url)
        ->assertOk()
        ->assertSee('data-settings-section=""', false);
})->with(['/settings', '/admin/settings']);

test('an unknown settings section is a 404, not a fallback page', function () {
    $this->get('/settings/nope')->assertNotFound();
    $this->get('/admin/settings/nope')->assertNotFound();
});

/*
 * The point of the two URL spaces: each page is only ever about its own
 * group. Crossing between them is the main sidebar's job.
 */
test('the settings nav lists the group you are in and nothing else', function () {
    $personal = settingsNav($this->get('/settings'));
    $application = settingsNav($this->get('/admin/settings'));

    foreach (array_keys(SettingsPageController::PERSONAL) as $segment) {
        $href = 'href="'.route("settings.{$segment}").'"';

        expect($personal)->toContain($href)
            ->and($application)->not->toContain($href);
    }

    foreach (array_keys(SettingsPageController::APPLICATION) as $segment) {
        $href = 'href="'.route("admin.settings.{$segment}").'"';

        expect($application)->toContain($href)
            ->and($personal)->not->toContain($href);
    }
});

test('the section you are on is the one marked active', function () {
    preg_match(
        '/<a[^>]*settings-nav__link--active[^>]*>/',
        settingsNav($this->get('/settings/appearance')),
        $matches,
    );

    expect($matches[0] ?? '')
        ->toContain('href="'.route('settings.appearance').'"')
        ->toContain('aria-current="page"');
});

test('back out of a section lands on that group index', function () {
    $this->get('/settings/security')
        ->assertSee('settings-back-btn" href="'.route('settings').'"', false);

    $this->get('/admin/settings/security')
        ->assertSee('settings-back-btn" href="'.route('admin.settings').'"', false);
});

test('only the application nav is role-gated, and the way to it from personal settings', function () {
    expect(settingsNav($this->get('/admin/settings')))
        ->toContain('data-requires-role="SUPER_ADMIN,ADMIN"');

    $personal = settingsNav($this->get('/settings'));

    preg_match('/<nav[^>]*>/s', $personal, $opening);
    preg_match('/<div class="settings-nav__admin"[^>]*>/s', $personal, $admin);

    expect($opening[0] ?? '')->not->toContain('data-requires-role')
        ->and($admin[0] ?? '')->toContain('data-requires-role="SUPER_ADMIN,ADMIN"')
        ->and($admin[0] ?? '')->toContain('hidden')
        ->and($personal)->toContain('href="'.route('admin.settings').'"');
});

/*
 * Both groups' URLs still reach the page's JS, which needs them to
 * forward a legacy `#section` hash and to bounce a non-admin out of the
 * Application space — neither can read a nav listing one group.
 */
test('the page hands its JS the URL of every section in both groups', function () {
    $expected = [];

    foreach (SettingsPageController::PERSONAL as $segment => $id) {
        $expected[$id] = route("settings.{$segment}");
    }

    foreach (SettingsPageController::APPLICATION as $segment => $id) {
        $expected[$id] = route("admin.settings.{$segment}");
    }

    expect(settingsRoutes($this->get('/settings')))->toBe($expected);
});

test('the profile page is its own page again, with editing in settings', function () {
    $this->get('/profile')->assertOk()->assertSee('data-profile-page', false);
});
