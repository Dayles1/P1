<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Notifications\NewLoginNotification;
use App\Domain\Notification\Notifications\RoleChangedNotification;
use App\Domain\Notification\Notifications\SystemNotification;
use Illuminate\Support\Facades\Notification;

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

function loginFrom(User $user, string $userAgent, string $ip = '10.0.0.1'): void
{
    forgetAuthGuards();

    test()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->withHeader('User-Agent', $userAgent)
        ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password123'])
        ->assertOk();
}

function loginUser(): User
{
    $user = User::factory()->create(['password' => bcrypt('Password123')]);
    $user->assignRole(Role::USER);

    return $user;
}

test('the very first login is not announced', function () {
    Notification::fake();
    $user = loginUser();

    loginFrom($user, CHROME_WINDOWS);

    Notification::assertNotSentTo($user, NewLoginNotification::class);
});

test('logging in again from the same browser, platform and address is not announced', function () {
    Notification::fake();
    $user = loginUser();

    loginFrom($user, CHROME_WINDOWS);
    loginFrom($user, CHROME_WINDOWS);

    Notification::assertNotSentTo($user, NewLoginNotification::class);
});

test('a login from a new browser or a new address is announced with the device details', function () {
    Notification::fake();
    $user = loginUser();

    loginFrom($user, CHROME_WINDOWS);
    loginFrom($user, FIREFOX_LINUX);
    loginFrom($user, CHROME_WINDOWS, '10.0.0.2');

    Notification::assertSentToTimes($user, NewLoginNotification::class, 2);

    $data = Notification::sent($user, NewLoginNotification::class)->first()->toDatabase($user);

    expect($data)->toMatchArray([
        'type' => 'new_login',
        'action_url' => '/sessions',
        'ip_address' => '10.0.0.1',
    ])->and($data['browser'])->not->toBeEmpty()
        ->and($data['platform'])->not->toBeEmpty()
        ->and($data['session_id'])->toBeInt()
        ->and($data['logged_in_at_iso'])->toBeString();
});

test('the security switch turns new-login notifications off', function () {
    $user = loginUser();
    $user->settings()->create(['timezone_id' => timezoneRow('UTC')->id, 'meta' => ['notifications' => ['security' => false]]]);

    loginFrom($user, CHROME_WINDOWS);
    loginFrom($user, FIREFOX_LINUX);

    expect($user->notifications()->count())->toBe(0);
});

test('changing someone\'s role tells them who changed it and to what', function () {
    Notification::fake();
    makeRole('ADMIN');
    $admin = userWithRole('SUPER_ADMIN');
    [$token] = createUserSession($admin);
    $target = userWithRole('USER');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => 'ADMIN'])
        ->assertOk();

    $names = Role::query()->pluck('name', 'code');

    Notification::assertSentTo($target, RoleChangedNotification::class, function (RoleChangedNotification $notification) use ($target, $admin, $names) {
        $data = $notification->toDatabase($target);

        return $data['type'] === 'role_changed'
            && $data['role_code'] === 'ADMIN'
            && $data['role_name'] === $names['ADMIN']
            && $data['previous_role_name'] === $names['USER']
            && $data['actor']['id'] === $admin->id
            && $data['action_url'] === '/profile';
    });
    Notification::assertNotSentTo($admin, RoleChangedNotification::class);
});

test('setting the role a user already has sends nothing', function () {
    Notification::fake();
    $admin = userWithRole('SUPER_ADMIN');
    [$token] = createUserSession($admin);
    $target = userWithRole('USER');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => 'USER'])
        ->assertOk();

    Notification::assertNothingSent();
});

test('auth/me carries the unread notification count for the header bell', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('One', 'Body'));
    $user->notify(new SystemNotification('Two', 'Body'));
    $user->notifications()->first()->markAsRead();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('data.unread_notifications_count', 1)
        ->assertJsonPath('data.user.id', $user->id);
});

test('the type filter accepts several types at once', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('Sys', 'Body'));
    $user->notify(new NewLoginNotification(createUserSession($user)[1]));
    $user->notify(new RoleChangedNotification($user, 'ADMIN', 'Admin'));

    $types = collect($this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/notifications?type=new_login,role_changed')
        ->assertOk()
        ->json('data'))->pluck('type')->sort()->values()->all();

    expect($types)->toBe(['new_login', 'role_changed']);
});
