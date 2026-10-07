<?php

namespace App\Games\Epochs\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * What changed since the last save: the world's numbers, changed tiles,
 * changed and removed buildings, and the residents. `revision` is the one
 * the browser last saw — a tab that fell behind is refused.
 */
class SyncWorldRequest extends FormRequest
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
            'revision' => ['required', 'integer', 'min:1'],
            ...$this->worldRules(),
            'tiles' => ['present', 'array', $this->tilesRule()],
            'buildings' => ['required', 'array'],
            ...$this->buildingRules('buildings.upsert'),
            'buildings.delete' => ['present', 'array', 'max:6000'],
            'buildings.delete.*' => ['integer', 'min:1'],
            ...$this->npcRules(),
        ];
    }
}
