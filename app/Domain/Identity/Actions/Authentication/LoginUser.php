<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Actions\Authentication\Concerns\IssuesAuthenticatedSession;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\VerificationCode;
use App\Domain\Identity\Notifications\VerificationCodeNotification;
use App\Domain\Identity\Services\VerificationCodeService;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUser
{
    use IssuesAuthenticatedSession;

    public function __construct(
        private readonly SettingService $settings,
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    /**
     * Returns either `['user' => ..., 'token' => ...]` (login complete) or
     * `['requires_verification' => true, 'challenge_token' => ...]` (the
     * account has "require a verification code on every login" turned on
     * — see UserSetting::require_login_verification — so a second step,
     * AuthController::verifyLoginCode(), must complete before a token is
     * issued).
     */
    public function handle(array $data, DeviceData $device): array
    {
        if (! $this->settings->boolean('auth.login_open', true)) {
            abort(403, __('auth.login_closed'));
        }

        $user = User::query()
            ->with(['department.ban', 'ban', 'settings'])
            ->where('email', $data['email'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.invalid_credentials'),
            ]);
        }

        if ($user->isBanned()) {
            throw ValidationException::withMessages([
                'email' => __('auth.user_banned'),
            ]);
        }

        if ($user->department?->isBanned()) {
            throw ValidationException::withMessages([
                'email' => __('auth.department_banned'),
            ]);
        }

        $allowedRoles = $this->settings->json('auth.allowed_login_role_ids');

        if ($allowedRoles !== [] && ! $user->roles()->whereIn('roles.id', $allowedRoles)->exists()) {
            abort(403, __('auth.role_not_allowed'));
        }

        if ($user->settings?->require_login_verification) {
            $generated = $this->verificationCodes->generate(
                $user,
                VerificationCode::PURPOSE_LOGIN_2FA,
                ipAddress: $device->ip_address,
                userAgent: $device->user_agent,
            );

            $user->notify(new VerificationCodeNotification($generated['code'], VerificationCode::PURPOSE_LOGIN_2FA));

            return [
                'requires_verification' => true,
                'challenge_token' => $generated['challenge_token'],
            ];
        }

        return $this->issueTokenAndSession($user, $device);
    }
}
