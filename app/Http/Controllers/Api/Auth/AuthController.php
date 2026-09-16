<?php

namespace App\Http\Controllers\Api\Auth;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Actions\Authentication\CompleteCodeLogin;
use App\Domain\Identity\Actions\Authentication\ConfirmUserPassword;
use App\Domain\Identity\Actions\Authentication\GetCurrentUser;
use App\Domain\Identity\Actions\Authentication\LoginUser;
use App\Domain\Identity\Actions\Authentication\LogoutUser;
use App\Domain\Identity\Actions\Authentication\RegisterUser;
use App\Domain\Identity\Actions\Authentication\RequestLoginCode;
use App\Domain\Identity\Actions\Authentication\ResendEmailVerification;
use App\Domain\Identity\Actions\Authentication\ResendLoginVerificationCode;
use App\Domain\Identity\Actions\Authentication\ResetUserPassword;
use App\Domain\Identity\Actions\Authentication\SendPasswordResetLink;
use App\Domain\Identity\Actions\Authentication\VerifyEmailByCode;
use App\Domain\Identity\Actions\Authentication\VerifyUserEmail;
use App\Domain\Identity\Exceptions\VerificationCodeException;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\VerificationCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ConfirmPasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\RequestLoginCodeRequest;
use App\Http\Requests\Auth\ResendLoginCodeRequest;
use App\Http\Requests\Auth\ResendVerificationRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\VerifyEmailCodeRequest;
use App\Http\Requests\Auth\VerifyLoginCodeRequest;
use App\Http\Resources\Auth\AuthUserResource;
use App\Http\Resources\Profile\ProfileResource;
use App\Infrastructure\Device\UserAgentParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

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
        protected RequestLoginCode $requestLoginCode,
        protected CompleteCodeLogin $completeCodeLogin,
        protected VerifyEmailByCode $verifyEmailByCode,
        protected ResendLoginVerificationCode $resendLoginVerificationCode,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $parsedDevice = $this->userAgentParser->parse($request->userAgent());

        $result = $this->loginUser->handle(
            $request->validated(),
            DeviceData::fromRequest($request, $parsedDevice)
        );

        if ($result['requires_verification'] ?? false) {
            return $this->success(
                data: [
                    'requires_verification' => true,
                    'challenge_token' => $result['challenge_token'],
                ],
                message: __('messages.auth.verification_required')
            );
        }

        return $this->success(
            data: [
                'user' => new AuthUserResource($result['user']),
                'token' => $result['token'],
            ],
            message: __('messages.auth.login_success')
        );
    }

    /** Completes a password login for an account with "verify every login" turned on. */
    public function verifyLoginCode(VerifyLoginCodeRequest $request): JsonResponse
    {
        return $this->completeCodeLoginResponse(
            $request,
            $request->validated('challenge_token'),
            $request->validated('code'),
            VerificationCode::PURPOSE_LOGIN_2FA,
        );
    }

    /** Passwordless login, step 1: request a code by email. */
    public function requestLoginCode(RequestLoginCodeRequest $request): JsonResponse
    {
        $challengeToken = $this->requestLoginCode->handle(
            $request->validated('email'),
            $request->ip(),
            $request->userAgent(),
        );

        return $this->success(
            data: ['challenge_token' => $challengeToken],
            message: __('messages.auth.code_sent')
        );
    }

    /** Passwordless login, step 2: verify the code and sign in — no password involved. */
    public function verifyLoginCodeLogin(VerifyLoginCodeRequest $request): JsonResponse
    {
        return $this->completeCodeLoginResponse(
            $request,
            $request->validated('challenge_token'),
            $request->validated('code'),
            VerificationCode::PURPOSE_PASSWORDLESS_LOGIN,
        );
    }

    /** Resend for either code-login flow — see ResendLoginVerificationCode. */
    public function resendLoginCode(ResendLoginCodeRequest $request): JsonResponse
    {
        $challengeToken = $this->resendLoginVerificationCode->handle(
            $request->validated('challenge_token'),
            $request->validated('purpose'),
        ) ?? Str::random(48);

        return $this->success(
            data: ['challenge_token' => $challengeToken],
            message: __('messages.auth.code_sent')
        );
    }

    private function completeCodeLoginResponse(
        Request $request,
        string $challengeToken,
        string $code,
        string $purpose,
    ): JsonResponse {
        $parsedDevice = $this->userAgentParser->parse($request->userAgent());

        try {
            $result = $this->completeCodeLogin->handle(
                $challengeToken,
                $code,
                $purpose,
                DeviceData::fromRequest($request, $parsedDevice),
            );
        } catch (VerificationCodeException $exception) {
            return $this->error(
                message: $exception->getMessage(),
                status: 422,
                data: ['error_code' => $exception->reason],
            );
        }

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
                'email_challenge_token' => $result['email_challenge_token'],
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

        if (! $user || ! hash_equals($hash, sha1($user->getEmailForVerification()))) {
            return redirect()->to('/login?verified=invalid');
        }

        $verified = $this->verifyUserEmail->handle($user);

        return redirect()->to($verified ? '/login?verified=1' : '/login?verified=already');
    }

    /** The code-entry counterpart to verifyEmail() (the signed-link click) — either one verifies the account. */
    public function verifyEmailCode(VerifyEmailCodeRequest $request): JsonResponse
    {
        try {
            $verified = $this->verifyEmailByCode->handle(
                $request->user(),
                $request->validated('code'),
                $request->validated('challenge_token'),
            );
        } catch (VerificationCodeException $exception) {
            return $this->error(
                message: $exception->getMessage(),
                status: 422,
                data: ['error_code' => $exception->reason],
            );
        }

        return $this->success(
            data: ['verified' => $verified],
            message: $verified
                ? __('messages.auth.email_verified')
                : __('messages.auth.email_already_verified')
        );
    }

    public function resendVerification(ResendVerificationRequest $request): JsonResponse
    {
        $user = $request->user()
            ?? User::where('email', $request->validated('email'))->first();

        if (! $user) {
            return $this->error(
                message: __('messages.auth.email_not_found'),
                status: 422
            );
        }

        $challengeToken = $this->resendEmailVerification->handle($user);

        return $this->success(
            data: [
                'sent' => $challengeToken !== null,
                'email_challenge_token' => $challengeToken,
            ],
            message: $challengeToken !== null
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

        if (! $confirmed) {
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
