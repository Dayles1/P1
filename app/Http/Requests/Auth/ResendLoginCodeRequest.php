<?php

namespace App\Http\Requests\Auth;

use App\Domain\Identity\Models\VerificationCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResendLoginCodeRequest extends FormRequest
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
            'challenge_token' => ['required', 'string'],
            'purpose' => [
                'required',
                'string',
                Rule::in([
                    VerificationCode::PURPOSE_LOGIN_2FA,
                    VerificationCode::PURPOSE_PASSWORDLESS_LOGIN,
                ]),
            ],
        ];
    }
}
