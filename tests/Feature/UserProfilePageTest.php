<?php

use Illuminate\Support\Arr;

test('a public profile page hands its script the user id and the hooks it fills', function () {
    $html = $this->get('/users/42')->assertOk()->getContent();

    expect($html)->toContain('data-user-profile-page data-user-id="42"')
        ->and($html)->toContain('data-user-name')
        ->and($html)->toContain('data-user-avatar')
        ->and($html)->toContain('data-user-actions')
        ->and($html)->toContain('data-user-groups')
        ->and($html)->toContain('data-user-tab="files"')
        ->and($html)->toContain('data-user-write-form')
        ->and($html)->toContain('data-user-common')
        ->and(substr_count($html, 'data-user-fact="'))->toBe(6)
        ->and($html)->toContain('data-user-fact="telegram"');
});

test('a public profile page only takes a numeric id', function () {
    $this->get('/users/abc')->assertNotFound();
});

test('the public profile page is translated in every locale', function (string $locale) {
    $html = $this->withUnencryptedCookie('locale', $locale)->get('/users/1')->assertOk()->getContent();
    $dictionary = require lang_path("{$locale}/ui.php");
    $script = file_get_contents(resource_path('js/blade/app/user-profile.js'));

    preg_match_all("/\bt\(\s*'((?:user_profile|profile_page|chat)\.[a-z0-9_.]+)'/", $script, $keys);

    expect($html)->not->toContain('ui.user_profile.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'user_profile.sections.contacts')));

    foreach (array_unique($keys[1]) as $key) {
        expect(Arr::has($dictionary, $key))->toBeTrue("{$locale}: {$key} is missing");
    }
})->with(['ru', 'uz', 'en']);

test('the keys the profile scripts build at runtime exist in every locale', function (string $locale) {
    $dictionary = require lang_path("{$locale}/ui.php");
    $keys = [
        'user_profile.activity.group_created', 'user_profile.activity.group_joined', 'user_profile.activity.message',
        'user_profile.reply_time.minutes', 'user_profile.reply_time.hour', 'user_profile.reply_time.day', 'user_profile.reply_time.slow',
        'user_profile.menu.notify_online', 'user_profile.menu.notify_online_off', 'user_profile.menu.block', 'user_profile.menu.unblock',
        'user_profile.report.reasons.spam', 'user_profile.report.reasons.abuse', 'user_profile.report.reasons.fake', 'user_profile.report.reasons.other',
        'user_profile.notify.on', 'user_profile.notify.off', 'user_profile.notify.came_online', 'user_profile.members',
        'user_profile.block.blocked', 'user_profile.block.unblocked',
        'profile.public.title', 'profile.public.position', 'profile.public.bio', 'profile.public.tags',
        'profile.public.phone', 'profile.public.phone_visible', 'profile.public.telegram', 'profile.public.view',
    ];

    foreach ($keys as $key) {
        expect(Arr::has($dictionary, $key))->toBeTrue("{$locale}: {$key} is missing");
    }
})->with(['ru', 'uz', 'en']);
