<?php

namespace App\Domain\Identity\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail as BaseVerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\HtmlString;

/**
 * The same signed-URL verification link Laravel sends by default, plus a
 * 6-digit code in the same email — either one verifies the account (see
 * VerifyEmailCodeRequest / AuthController::verifyEmailCode). Neither
 * method is required; the user picks whichever is convenient.
 */
class VerifyEmailWithCode extends BaseVerifyEmail
{
    public function __construct(
        private readonly string $code,
    ) {}

    public function toMail(mixed $notifiable): MailMessage
    {
        $url = $this->verificationUrl($notifiable);

        return (new MailMessage)
            ->subject(__('auth.verify_email.subject'))
            ->line(__('auth.verify_email.intro'))
            ->action(__('auth.verify_email.action'), $url)
            ->line(__('auth.verify_email.or_code'))
            ->line(new HtmlString(sprintf(
                '<strong style="font-size:24px; letter-spacing:6px;">%s</strong>',
                e($this->code)
            )))
            ->line(__('auth.verify_email.expires', ['minutes' => 10]));
    }
}
