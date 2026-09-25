<?php

use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/**
 * The dashboard's own markup — everything inside `<main>`, without the
 * shell around it.
 */
function dashboardContent(TestResponse $response): string
{
    preg_match('/<main class="app-main".*?<\/main>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

/**
 * Every literal `t('dashboard.…')` / `dictionary('dashboard.…')` key the
 * page script asks for.
 *
 * @return list<string>
 */
function dashboardScriptKeys(): array
{
    preg_match_all("/\b(?:t|dictionary)\(\s*'(dashboard\.[a-z0-9_.]+)'/", file_get_contents(resource_path('js/blade/app/dashboard.js')), $matches);

    return array_values(array_unique($matches[1]));
}

test('the dashboard renders its widgets as hooks the page script fills', function () {
    $html = dashboardContent($this->get('/dashboard')->assertOk());

    expect($html)->toContain('data-dashboard-welcome')
        ->and($html)->toContain('data-dashboard-greeting')
        ->and($html)->toContain('data-dashboard-date')
        ->and($html)->toContain('data-stat-grid')
        ->and($html)->toContain('data-recent-conversations')
        ->and($html)->toContain('data-recent-requests')
        ->and($html)->toContain('data-recent-sessions')
        ->and($html)->toMatch('/<progress class="progress__bar" max="100" value="0"[^>]*data-completeness-bar>/')
        ->and(substr_count($html, 'data-profile-check="'))->toBe(4)
        ->and(substr_count($html, 'class="skeleton skeleton--card"'))->toBe(10);
});

test('the profile card waits for the summary before it shows figures or its call to action', function () {
    $html = dashboardContent($this->get('/dashboard')->assertOk());

    preg_match('/<h2[^>]*data-completeness-value>.*?<\/h2>/s', $html, $title);
    preg_match('/<span[^>]*data-completeness-count>.*?<\/span>\s*<\/span>/s', $html, $count);
    preg_match('/<a[^>]*data-profile-fill[^>]*>/', $html, $fill);

    expect($title[0] ?? '')->toContain('skeleton skeleton--text')
        ->and($count[0] ?? '')->toContain('skeleton skeleton--text')
        ->and($fill[0] ?? '')->toContain('dashboard-profile__action--pending')
        ->and($fill[0] ?? '')->toContain('aria-hidden="true"')
        ->and($fill[0] ?? '')->toContain('tabindex="-1"')
        ->and(substr_count($html, 'data-profile-check-state'))->toBe(4);
});

test('the dashboard quick actions start a chat, switch the theme and open settings', function () {
    $html = dashboardContent($this->get('/dashboard')->assertOk());

    expect(preg_match_all('/\sdata-dashboard-new-chat[\s=>]/', $html))->toBe(2)
        ->and($html)->toContain('data-dashboard-toggle-theme')
        ->and($html)->toContain('href="'.route('settings.security').'"')
        ->and($html)->toContain('href="'.route('settings.language').'"')
        ->and($html)->toContain('href="'.route('settings.profile').'"')
        ->and($html)->toContain('<use href="#i-moon">')
        ->and($html)->toContain('<use href="#i-sun">');
});

test('the system overview stays hidden and admin-only until the summary says otherwise', function () {
    $html = dashboardContent($this->get('/dashboard')->assertOk());

    preg_match('/<section[^>]*data-instance-overview[^>]*>/s', $html, $overview);

    expect($overview[0] ?? '')->toContain('data-requires-role="SUPER_ADMIN,ADMIN"')
        ->and($overview[0] ?? '')->toContain('hidden')
        ->and($html)->toContain('href="'.route('admin.settings').'"');
});

test('the dashboard markup carries no inline styles or emoji', function () {
    $html = dashboardContent($this->get('/dashboard')->assertOk());
    $script = file_get_contents(resource_path('js/blade/app/dashboard.js'));

    expect($html)->not->toContain('style="')
        ->and($html)->not->toMatch('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/u')
        ->and($script)->not->toContain('style=')
        ->and($script)->not->toContain('.style.');
});

test('the dashboard is translated in every locale', function (string $locale) {
    $html = dashboardContent($this->withUnencryptedCookie('locale', $locale)->get('/dashboard')->assertOk());
    $dictionary = require lang_path("{$locale}/ui.php");

    expect($html)->not->toContain('ui.dashboard.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'dashboard.checks.avatar')))
        ->and($html)->toContain(e(Arr::get($dictionary, 'dashboard.change_theme')));

    foreach (dashboardScriptKeys() as $key) {
        expect(Arr::get($dictionary, $key))->toBeString("{$locale}: {$key} is missing");
    }

    foreach (range(0, 6) as $day) {
        expect(Arr::get($dictionary, "dashboard.date.weekdays.{$day}"))->toBeString()
            ->and(Arr::get($dictionary, "dashboard.date.weekdays_short.{$day}"))->toBeString();
    }

    foreach (range(0, 11) as $month) {
        expect(Arr::get($dictionary, "dashboard.date.months.{$month}"))->toBeString()
            ->and(Arr::get($dictionary, "dashboard.date.months_short.{$month}"))->toBeString();
    }
})->with(['ru', 'uz', 'en']);

test('numbers without the browser locale data use the separators of their language', function (string $locale, string $group, string $decimal) {
    $dictionary = require lang_path("{$locale}/ui.php");

    expect(Arr::get($dictionary, 'dashboard.number.group'))->toBe($group)
        ->and(Arr::get($dictionary, 'dashboard.number.decimal'))->toBe($decimal);
})->with([
    'ru groups with a no-break space' => ['ru', "\u{00A0}", ','],
    'uz groups with a no-break space' => ['uz', "\u{00A0}", ','],
    'en groups with a comma' => ['en', ',', '.'],
]);
