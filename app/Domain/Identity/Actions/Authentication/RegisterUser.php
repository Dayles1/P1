<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Actions\User\CreateUser;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RegisterUser
{
    public function __construct(
        private readonly SettingService $settings,
        private readonly CreateUser $createUser,
    ) {}

    public function handle(array $data): array
    {
        if (! $this->settings->boolean('auth.registration_open', true)) {
            throw new AccessDeniedHttpException(__('auth.registration_closed'));
        }

        $maxUsers = $this->settings->integer('auth.max_users_count');

        if ($maxUsers > 0 && User::count() >= $maxUsers) {
            throw new HttpException(422, __('auth.max_users_limit_reached'));
        }

        $dailyLimit = $this->settings->integer('auth.max_register_users_count');

        if (
            $dailyLimit > 0 &&
            User::whereDate('created_at', today())->count() >= $dailyLimit
        ) {
            throw new HttpException(422, __('auth.daily_registration_limit_reached'));
        }

        $user = $this->createUser->handle($data);

        if ($this->settings->boolean('auth.email_verification_required')) {
            $user->sendEmailVerificationNotification();
        } else {
            $user->markEmailAsVerified();
        }

        $defaultRole = $this->settings->string('auth.default_role', Role::USER);

        $role = Role::query()
            ->where('name', $defaultRole)
            ->first();

        if ($role) {
            $user->roles()->sync([$role->id]);
        }

        return [
            'user' => $user,
        ];
    }
}
