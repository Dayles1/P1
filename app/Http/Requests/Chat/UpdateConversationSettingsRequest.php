<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateConversationSettingsRequest extends FormRequest
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
            'mute' => ['nullable', Rule::in(['1h', '8h', '1d', '3d', 'forever', 'off'])],
            'archived' => ['nullable', 'boolean'],
            'marked_unread' => ['nullable', 'boolean'],
            'pinned' => ['nullable', 'boolean'],
        ];
    }
}
