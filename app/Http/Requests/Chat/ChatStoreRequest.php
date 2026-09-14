<?php

namespace App\Http\Requests\Chat;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChatStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => [
                'required',
                'in:private,group,channel',
            ],

            'title' => [
                'required_unless:type,private',
                'string',
                'min:3',
                'max:60',
            ],

            'user_ids' => [
                'required',
                'array',
                'min:1',
                'max:100',
                Rule::when(
                    fn () => $this->input('type') === 'private',
                    ['size:1'],
                ),
            ],

            'user_ids.*' => [
                'integer',
                'exists:users,id',
            ],
        ];
    }
}
