<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/**
 * Someone reported a user from their profile — sent to super admins and
 * admins, linking to the reported profile.
 */
class UserReportedNotification extends BaseNotification
{
    public function __construct(
        public User $reporter,
        public User $reported,
        public string $reason,
        public ?string $comment = null,
    ) {}

    public function type(): string
    {
        return 'user_report';
    }

    /**
     * @return array{type: string, title: string, body: string, action_url: string, reporter_id: int, reporter_name: string, user_id: int, user_name: string, reason: string, comment: string|null, actor: array{id: int, name: string, avatar: string|null}}
     */
    public function toDatabase(User $notifiable): array
    {
        $locale = $notifiable->settings?->locale ?: app()->getLocale();
        $reason = __("ui.user_profile.report.reasons.{$this->reason}", [], $locale);

        return [
            'type' => $this->type(),
            'title' => __('ui.user_profile.report.notification_title', ['name' => $this->reported->name], $locale),
            'body' => $this->comment ? "{$reason} — {$this->comment}" : $reason,
            'action_url' => "/users/{$this->reported->id}",
            'reporter_id' => (int) $this->reporter->id,
            'reporter_name' => $this->reporter->name,
            'user_id' => (int) $this->reported->id,
            'user_name' => $this->reported->name,
            'reason' => $this->reason,
            'comment' => $this->comment,
            'actor' => [
                'id' => (int) $this->reporter->id,
                'name' => $this->reporter->name,
                'avatar' => $this->reporter->avatar?->url,
            ],
        ];
    }
}
