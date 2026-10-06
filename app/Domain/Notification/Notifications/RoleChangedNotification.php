<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** An administrator gave you another role. */
class RoleChangedNotification extends BaseNotification
{
    public function __construct(
        protected User $actor,
        protected string $roleCode,
        protected string $roleName,
        protected ?string $previousRoleName = null,
    ) {}

    public function type(): string
    {
        return 'role_changed';
    }

    /**
     * @return array{type: string, title: string, body: string, action_url: string, role_code: string, role_name: string, previous_role_name: string|null, actor: array{id: int, name: string, avatar: string|null}}
     */
    public function toDatabase(User $notifiable): array
    {
        $locale = $this->localeFor($notifiable);

        return [
            'type' => $this->type(),
            'title' => (string) __('ui.notifications.server.role_changed_title', [], $locale),
            'body' => (string) __('ui.notifications.server.role_changed', [
                'name' => $this->actor->name,
                'role' => $this->roleName,
            ], $locale),
            'action_url' => '/profile',
            'role_code' => $this->roleCode,
            'role_name' => $this->roleName,
            'previous_role_name' => $this->previousRoleName,
            'actor' => self::actorPayload($this->actor),
        ];
    }
}
