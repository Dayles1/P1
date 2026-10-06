<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Notification\Notifications\UserReportedNotification;
use Illuminate\Support\Facades\Notification;

test('a report notifies the super admins and admins, not the reporter or the reported', function () {
    Notification::fake();

    $reporter = userWithRole(Role::ADMIN, ['name' => 'Reporter']);
    $reported = userWithRole(Role::ADMIN, ['name' => 'Spammer']);
    $superAdmin = userWithRole(Role::SUPER_ADMIN);
    $admin = userWithRole(Role::ADMIN);
    $user = userWithRole(Role::USER);

    $this->actingAs($reporter, 'sanctum')
        ->postJson("/api/users/{$reported->id}/report", ['reason' => 'spam', 'comment' => 'Sends ads'])
        ->assertOk()
        ->assertJsonPath('success', true);

    Notification::assertSentTo([$superAdmin, $admin], UserReportedNotification::class, function (UserReportedNotification $notification, array $channels, $notifiable) use ($reporter, $reported) {
        $data = $notification->toDatabase($notifiable);

        return $data['type'] === 'user_report'
            && $data['reporter_id'] === $reporter->id
            && $data['reporter_name'] === 'Reporter'
            && $data['user_id'] === $reported->id
            && $data['user_name'] === 'Spammer'
            && $data['reason'] === 'spam'
            && $data['comment'] === 'Sends ads'
            && $data['action_url'] === "/users/{$reported->id}"
            && $data['title'] !== ''
            && $channels === ['database', 'broadcast'];
    });
    Notification::assertNotSentTo([$reporter, $reported, $user], UserReportedNotification::class);
});

test('a report is validated', function (array $payload) {
    Notification::fake();

    $reported = userWithRole(Role::USER);

    $this->actingAs(userWithRole(Role::USER), 'sanctum')
        ->postJson("/api/users/{$reported->id}/report", $payload)
        ->assertUnprocessable();

    Notification::assertNothingSent();
})->with([
    'no reason' => [[]],
    'unknown reason' => [['reason' => 'boring']],
    'long comment' => [['reason' => 'other', 'comment' => str_repeat('a', 501)]],
]);

test('nobody can report themselves, and a banned user cannot be found', function () {
    Notification::fake();
    userWithRole(Role::SUPER_ADMIN);

    $user = userWithRole(Role::USER);
    $banned = userWithRole(Role::USER);
    app(BanEntity::class)->handle($banned, reason: 'test');

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/users/{$user->id}/report", ['reason' => 'fake'])
        ->assertUnprocessable();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/users/{$banned->id}/report", ['reason' => 'fake'])
        ->assertNotFound();

    Notification::assertNothingSent();
});

test('reporting requires authentication', function () {
    $this->postJson('/api/users/1/report', ['reason' => 'spam'])->assertUnauthorized();
});
