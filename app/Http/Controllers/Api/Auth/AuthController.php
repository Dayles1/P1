<?php

namespace App\Http\Controllers\Api\Auth;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Actions\Authentication\ConfirmUserPassword;
use App\Domain\Identity\Actions\Authentication\GetCurrentUser;
use App\Domain\Identity\Actions\Authentication\LoginUser;
use App\Domain\Identity\Actions\Authentication\LogoutUser;
use App\Domain\Identity\Actions\Authentication\RegisterUser;
use App\Domain\Identity\Actions\Authentication\ResendEmailVerification;
use App\Domain\Identity\Actions\Authentication\ResetUserPassword;
use App\Domain\Identity\Actions\Authentication\SendPasswordResetLink;
use App\Domain\Identity\Actions\Authentication\VerifyUserEmail;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ConfirmPasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResendVerificationRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\Auth\AuthUserResource;
use App\Http\Resources\Profile\ProfileResource;
use App\Infrastructure\Device\UserAgentParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function __construct(
        protected LoginUser $loginUser,
        protected RegisterUser $registerUser,
        protected LogoutUser $logoutUser,
        protected GetCurrentUser $getCurrentUser,
        protected UserAgentParser $userAgentParser,
        protected SendPasswordResetLink $sendPasswordResetLink,
        protected ResetUserPassword $resetUserPassword,
        protected VerifyUserEmail $verifyUserEmail,
        protected ResendEmailVerification $resendEmailVerification,
        protected ConfirmUserPassword $confirmUserPassword,
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
        $this->logoutUser->handle(Auth::user());

        return $this->success(
            message: __('messages.auth.logout_success')
        );
    }

    public function me(): JsonResponse
{
    return $this->success(
        data: [
            'user' => new ProfileResource(
                $this->getCurrentUser->handle(Auth::user())
            ),
        ],
        message: __('messages.auth.me_success')
    );
}

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->sendPasswordResetLink->handle($request->validated('email'));

        return $this->success(
            message: __('messages.auth.password_reset_link_sent')
        );
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $this->resetUserPassword->handle($request->validated());

        return $this->success(
            message: __('messages.auth.password_reset_success')
        );
    }

    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::find($id);

        if (!$user || !hash_equals($hash, sha1($user->getEmailForVerification()))) {
            return redirect()->to('/login?verified=invalid');
        }

        $verified = $this->verifyUserEmail->handle($user);

        return redirect()->to($verified ? '/login?verified=1' : '/login?verified=already');
    }

    public function resendVerification(ResendVerificationRequest $request): JsonResponse
    {
        $user = $request->user()
            ?? User::where('email', $request->validated('email'))->first();

        if (!$user) {
            return $this->error(
                message: __('messages.auth.email_not_found'),
                status: 422
            );
        }

        $sent = $this->resendEmailVerification->handle($user);

        return $this->success(
            data: ['sent' => $sent],
            message: $sent
                ? __('messages.auth.verification_link_sent')
                : __('messages.auth.email_already_verified')
        );
    }

    public function confirmPassword(ConfirmPasswordRequest $request): JsonResponse
    {
        $confirmed = $this->confirmUserPassword->handle(
            $request->user(),
            $request->validated('password')
        );

        if (!$confirmed) {
            return $this->error(
                message: __('messages.auth.invalid_password'),
                status: 422
            );
        }

        return $this->success(
            data: ['confirmed' => true],
            message: __('messages.auth.password_confirmed')
        );
    }

}