<?php

use App\Http\Controllers\Web\Blade\SettingsPageController;

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

test('the settings index renders with no section of its own', function () {
    $this->get('/settings')
        ->assertOk()
        ->assertSee('data-settings-section=""', false);
});

test('an unknown settings section is a 404, not a fallback page', function () {
    $this->get('/settings/nope')->assertNotFound();
    $this->get('/admin/settings/nope')->assertNotFound();
});

test('the settings sidebar links to every section, personal and application', function () {
    $response = $this->get('/settings');

    foreach (array_keys(SettingsPageController::PERSONAL) as $segment) {
        $response->assertSee('href="'.route("settings.{$segment}").'"', false);
    }

    foreach (array_keys(SettingsPageController::APPLICATION) as $segment) {
        $response->assertSee('href="'.route("admin.settings.{$segment}").'"', false);
    }
});

test('the application group is role-gated in the markup', function () {
    $this->get('/settings')->assertSee('data-requires-role="SUPER_ADMIN,ADMIN"', false);
});

test('the admin settings group redirects to its first section', function () {
    $this->get('/admin/settings')->assertRedirect(route('admin.settings.general'));
});

test('the old standalone profile page redirects into settings', function () {
    $this->get('/profile')->assertRedirect(route('settings.profile'));
});
