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

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $emailChanging = $this->filled('email') && $this->input('email') !== $this->user()->email;
        $passwordChanging = $this->filled('password');

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

            'current_password' => [
                ($emailChanging || $passwordChanging) ? 'required' : 'nullable',
                'current_password:sanctum',
            ],

            'position' => ['sometimes', 'nullable', 'string', 'max:120'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:200'],
            'tags' => ['sometimes', 'nullable', 'array', 'max:8'],
            'tags.*' => ['string', 'max:24', 'distinct:ignore_case'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+\s\-()]+$/'],
            'phone_visible' => ['sometimes', 'boolean'],
            'telegram' => ['sometimes', 'nullable', 'string', 'regex:/^@?[A-Za-z0-9_]{5,32}$/'],
        ];
    }

    /**
     * Trims each tag and drops empty ones, so "a, , b" from the form
     * arrives as two tags.
     */
    protected function prepareForValidation(): void
    {
        if (is_array($this->input('tags'))) {
            $this->merge([
                'tags' => array_values(array_filter(
                    array_map(fn ($tag) => is_string($tag) ? trim($tag) : $tag, $this->input('tags')),
                    fn ($tag) => $tag !== '' && $tag !== null,
                )),
            ]);
        }
    }
}
