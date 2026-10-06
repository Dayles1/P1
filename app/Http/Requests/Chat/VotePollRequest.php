<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

class VotePollRequest extends FormRequest
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
            'option_ids' => ['required', 'array', 'min:1', 'max:10'],
            'option_ids.*' => ['integer', 'min:0', 'max:9'],
        ];
    }
}
