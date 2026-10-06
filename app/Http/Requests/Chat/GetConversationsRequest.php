<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GetConversationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `type` is the older name of `folder`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $folders = ['all', 'private', 'group', 'channel', 'archived'];

        return [
            'folder' => ['nullable', Rule::in($folders)],
            'type' => ['nullable', Rule::in($folders)],
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
