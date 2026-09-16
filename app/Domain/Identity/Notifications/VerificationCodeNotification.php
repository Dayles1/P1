<?php

namespace App\Domain\Identity\Notifications;

use App\Domain\Identity\Models\VerificationCode;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

class VerificationCodeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $code,
        private readonly string $purpose,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        [$subjectKey, $introKey] = match ($this->purpose) {
            VerificationCode::PURPOSE_LOGIN_2FA => ['auth.verification_code.login_subject', 'auth.verification_code.login_intro'],
            VerificationCode::PURPOSE_PASSWORDLESS_LOGIN => ['auth.verification_code.passwordless_subject', 'auth.verification_code.passwordless_intro'],
            default => ['auth.verification_code.generic_subject', 'auth.verification_code.generic_intro'],
        };

        return (new MailMessage)
            ->subject(__($subjectKey))
            ->line(__($introKey))
            ->line(new HtmlString(sprintf(
                '<strong style="font-size:24px; letter-spacing:6px;">%s</strong>',
                e($this->code)
            )))
            ->line(__('auth.verification_code.expires', ['minutes' => 10]));
    }
}
