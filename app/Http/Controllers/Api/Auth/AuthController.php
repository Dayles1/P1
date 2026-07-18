<?php

namespace App\Http\Controllers\Api\Auth;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Actions\Authentication\GetCurrentUser;
use App\Domain\Identity\Actions\Authentication\LoginUser;
use App\Domain\Identity\Actions\Authentication\LogoutUser;
use App\Domain\Identity\Actions\Authentication\RegisterUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\Auth\AuthUserResource;
use App\Http\Resources\Profile\ProfileResource;
use App\Infrastructure\Device\UserAgentParser;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(
        protected LoginUser $loginUser,
        protected RegisterUser $registerUser,
        protected LogoutUser $logoutUser,
        protected GetCurrentUser $getCurrentUser,
        protected UserAgentParser $userAgentParser,
    ) {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $parsedDevice = $this->userAgentParser->parse($request->userAgent());

        $result = $this->loginUser->handle(
            $request->validated(),
            DeviceData::fromRequest($request, $parsedDevice)
        );
        return $this->success(
            data: [
                'user' => new AuthUserResource($result['user']),
                'token' => $result['token'],
            ],
            message: __('messages.auth.login_success')
        );
    }
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->registerUser->handle($request->validated());
        return $this->success(
            data: [
                'user' => new AuthUserResource($result['user']),
            ],
            message: __('messages.auth.register_success')
        );
    }
    public function logout(): JsonResponse
    {
        $this->logoutUser->handle(auth()->user());

        return $this->success(
            message: __('messages.auth.logout_success')
        );
    }

    public function me(): JsonResponse
{
    return $this->success(
        data: [
            'user' => new ProfileResource(
                $this->getCurrentUser->handle(auth()->user())
            ),
        ],
        message: __('messages.auth.me_success')
    );
}

}