<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'string',
                'min:5',
                'max:60',
            ],

            'email' => [
                'sometimes',
                'email',
                Rule::unique('users', 'email')->ignore($this->user()),
            ],

            'password' => [
                'sometimes',
                'confirmed',
                Password::defaults(),
            ],

        ];
    }
}