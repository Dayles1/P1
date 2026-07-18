<?php

namespace App\Http\Requests\Chat;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GetConversationsRequest extends FormRequest
{
    
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => [
                'nullable',
                Rule::in([
                    'all',
                    'private',
                    'group',
                    'channel'
                ])
            ],

            'search' => [
                'nullable',
                'string',
                'max:255'
            ],

            'page' => [
                'nullable',
                'integer'
            ],
        ];
    }
}
