<?php

namespace App\Games\Epochs\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A brand-new world: every tile of its map, the starting buildings and
 * residents.
 */
class CreateWorldRequest extends FormRequest
{
    use WorldPayloadRules;

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
            ...$this->worldRules(),
            'tiles' => ['required', 'array', $this->tilesRule()],
            ...$this->buildingRules('buildings'),
            ...$this->npcRules(),
        ];
    }
}
