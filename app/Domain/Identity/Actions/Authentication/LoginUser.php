<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUser
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    public function handle(array $data, DeviceData $device): array
    {
        if (! $this->settings->boolean('auth.login_open', true)) {
            abort(403, __('auth.login_closed'));
        }

        $user = User::query()
            ->with(['department.ban', 'ban'])
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

        if ($allowedRoles !== [] && ! in_array($user->role_id, $allowedRoles, true)) {
            abort(403, __('auth.role_not_allowed'));
        }

        $token = $user->createToken('auth');

        UserSession::create([
            'user_id' => $user->id,
            'personal_access_token_id' => $token->accessToken->id,
            'ip_address' => $device->ip_address,
            'user_agent' => $device->user_agent,
            'device_type' => $device->device_type,
            'browser' => $device->browser,
            'platform' => $device->platform,
            'device_name' => $device->device_name,
            'logged_in_at' => now(),
            'last_activity_at' => now(),
        ]);

        return [
            'user' => $user,
            'token' => $token->plainTextToken,
        ];
    }
}