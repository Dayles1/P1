<?php

use App\Domain\Identity\Models\User;
use App\Domain\Setting\Models\Setting;

test('the X-Locale header selects the response language for a guest', function () {
    $response = $this->withHeaders(['X-Locale' => 'ru', 'Accept' => 'application/json'])
        ->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    expect($response->json('errors.email.0'))->toBe('Данные учётной записи не найдены.');
});

test('an unknown X-Locale value falls back rather than erroring', function () {
    $response = $this->withHeaders(['X-Locale' => 'xx-not-real', 'Accept' => 'application/json'])
        ->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    $response->assertStatus(422);
});

test('the locale cookie is honored on requests without an X-Locale header', function () {
    // Two Laravel test-client gotchas stacked here: (1) postJson() silently
    // drops cookies unless withCredentials() is set (mirrors a real
    // browser's fetch/XHR credentials:'include', which the app's axios
    // client does set); (2) withCookie() encrypts the value by default,
    // but the app's JS writes this cookie as plain text via document.cookie
    // and nothing decrypts it (EncryptCookies isn't in the `api` group) —
    // withUnencryptedCookie() matches what actually gets sent in production.
    $response = $this->withCredentials()
        ->withUnencryptedCookie('locale', 'uz')
        ->withHeaders(['Accept' => 'application/json'])
        ->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    expect($response->json('errors.email.0'))->toBe('Bunday maʼlumotlar tizimda topilmadi.');
});

test('the locale cookie survives a full page load, not just an XHR', function () {
    // The api-group test above ('the locale cookie is honored...') only
    // proves the cookie survives on /api/* routes, where EncryptCookies
    // isn't even in the pipeline — it says nothing about a real page
    // navigation (window.location.reload() after picking a language),
    // which goes through the `web` group where EncryptCookies *is* present.
    // Without excluding `locale` from it, this plaintext (document.cookie-
    // written) cookie gets silently decrypt-failed to null on every such
    // load, and the app falls through to Accept-Language browser detection
    // instead — so whatever the browser's own language was always won,
    // no matter what the user picked. This is the actual reported bug.
    // 'ru', deliberately not 'uz' (the seeded localization.default_locale) —
    // otherwise a broken cookie falling through to the default would still
    // coincidentally match and mask the bug this test exists to catch.
    Setting::where('key', 'localization.auto_detect_browser_locale')->update(['value' => '0']);

    $response = $this->withUnencryptedCookie('locale', 'ru')->get('/login');

    $response->assertOk();
    expect(app()->getLocale())->toBe('ru');
});

test('an authenticated user\'s saved locale takes priority over the X-Locale header', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);
    $timezone = timezoneRow('UTC');

    $user->settings()->create(['timezone_id' => $timezone->id, 'locale' => 'ru']);

    // The user's saved locale is 'ru'; the header claims 'uz' — 'ru' must win.
    $response = $this->withHeaders(['Authorization' => "Bearer {$token}", 'X-Locale' => 'uz'])
        ->deleteJson('/api/sessions/others');

    expect($response->json('message'))->toBe('Других активных сеансов не найдено.');
});

test('languages endpoint lists the active languages seeded for the app', function () {
    $this->getJson('/api/languages')
        ->assertOk()
        ->assertJsonFragment(['code' => 'en'])
        ->assertJsonFragment(['code' => 'ru'])
        ->assertJsonFragment(['code' => 'uz']);
});

test('the localization.default_locale setting is used when nothing else applies', function () {
    Setting::where('key', 'localization.default_locale')->update(['value' => 'ru']);
    // This shell's PHP process always carries a real Accept-Language
    // env value (leaks into every Symfony Request::create() in this test
    // run via $_SERVER), which would otherwise win before the setting is
    // ever consulted — turn off browser detection so "nothing else
    // applies" is actually true, deterministically, in any environment.
    Setting::where('key', 'localization.auto_detect_browser_locale')->update(['value' => '0']);

    $response = $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    expect($response->json('errors.email.0'))->toBe('Данные учётной записи не найдены.');
});
