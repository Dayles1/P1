<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'      => ['required','string','min:5','max:60'],
            'email'     => ['required','email','unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'timezone' => [
                'nullable',
                'string',
                'exists:timezones,name',
            ],
        ];
    }
}
