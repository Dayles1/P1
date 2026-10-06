<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;

/**
 * Someone signed in to your account from a device, browser or address it
 * was not used from before — so a login you did not make stands out.
 */
class NewLoginNotification extends BaseNotification
{
    public function __construct(
        protected UserSession $session,
    ) {}

    public function type(): string
    {
        return 'new_login';
    }

    /**
     * @return array{type: string, title: string, body: string, action_url: string, session_id: int, device_name: string|null, device_type: string|null, browser: string|null, platform: string|null, ip_address: string|null, logged_in_at_iso: string|null}
     */
    public function toDatabase(User $notifiable): array
    {
        $locale = $this->localeFor($notifiable);
        $unknown = (string) __('ui.notifications.server.unknown', [], $locale);
        $session = $this->session;

        return [
            'type' => $this->type(),
            'title' => (string) __('ui.notifications.server.new_login_title', [], $locale),
            'body' => (string) __('ui.notifications.server.new_login', [
                'browser' => $session->browser ?: $unknown,
                'platform' => $session->platform ?: $unknown,
                'ip' => $session->ip_address ?: $unknown,
            ], $locale),
            'action_url' => '/sessions',
            'session_id' => (int) $session->id,
            'device_name' => $session->device_name,
            'device_type' => $session->device_type,
            'browser' => $session->browser,
            'platform' => $session->platform,
            'ip_address' => $session->ip_address,
            'logged_in_at_iso' => $session->logged_in_at?->toIso8601String(),
        ];
    }
}
