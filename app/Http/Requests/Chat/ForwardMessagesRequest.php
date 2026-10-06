<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

class ForwardMessagesRequest extends FormRequest
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
            'from_conversation_id' => ['required', 'integer', 'min:1'],
            'message_ids' => ['required', 'array', 'min:1', 'max:100'],
            'message_ids.*' => ['integer', 'min:1'],
            'conversation_ids' => ['required', 'array', 'min:1', 'max:20'],
            'conversation_ids.*' => ['integer', 'min:1'],
            'comment' => ['nullable', 'string', 'max:5000'],
            'hide_sender' => ['nullable', 'boolean'],
        ];
    }
}
