<?php

namespace App\Http\Requests\Chat;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
                'required_unless:type,private',
                'array',
                'max:100',
            ],

            'user_ids.*' => [
                'integer',
                'exists:users,id',
            ],
        ];
    }
}