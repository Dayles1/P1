<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyEmailCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'size:6'],
            // Only needed when there's no bearer token yet (a freshly
            // registered user verifying before their first login) — see
            // AuthController::verifyEmailCode() / VerifyEmailByCode.
            'challenge_token' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
