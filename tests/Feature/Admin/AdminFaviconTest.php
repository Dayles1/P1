<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Setting\Actions\StoreFavicon;
use App\Domain\Setting\Models\Setting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('a regular user cannot upload a favicon', function () {
    Storage::fake('public');
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/admin/settings/favicon', ['file' => UploadedFile::fake()->create('icon.ico', 10)])
        ->assertForbidden();
});

test('an admin can upload a favicon and it becomes the active system.favicon setting', function () {
    Storage::fake('public');
    $admin = userWithRole(Role::ADMIN);

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/admin/settings/favicon', [
            'file' => UploadedFile::fake()->create('icon.ico', 10),
        ])
        ->assertOk();

    $url = $response->json('data.url');

    expect($url)->toStartWith('/storage/favicons/');
    expect(Setting::where('key', 'system.favicon')->value('value'))->toBe($url);
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));
});

test('uploading a new favicon deletes the previously uploaded one', function () {
    Storage::fake('public');
    $admin = userWithRole(Role::ADMIN);

    $first = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/admin/settings/favicon', ['file' => UploadedFile::fake()->create('a.ico', 10)])
        ->json('data.url');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/admin/settings/favicon', ['file' => UploadedFile::fake()->create('b.ico', 10)])
        ->assertOk();

    Storage::disk('public')->assertMissing(str_replace('/storage/', '', $first));
});

test('an admin can reset the favicon back to the default and the upload is removed', function () {
    Storage::fake('public');
    $admin = userWithRole(Role::ADMIN);

    $uploaded = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/admin/settings/favicon', ['file' => UploadedFile::fake()->create('icon.ico', 10)])
        ->json('data.url');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson('/api/admin/settings/favicon')
        ->assertOk()
        ->assertJsonPath('data.url', StoreFavicon::DEFAULT_PATH);

    expect(Setting::where('key', 'system.favicon')->value('value'))->toBe(StoreFavicon::DEFAULT_PATH);
    Storage::disk('public')->assertMissing(str_replace('/storage/', '', $uploaded));
});

test('favicon upload rejects disallowed file types', function () {
    Storage::fake('public');
    $admin = userWithRole(Role::ADMIN);

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/admin/settings/favicon', ['file' => UploadedFile::fake()->create('malware.exe', 10)])
        ->assertUnprocessable();
});
