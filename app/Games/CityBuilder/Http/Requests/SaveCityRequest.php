<?php

namespace App\Games\CityBuilder\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

class SaveCityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `revision` is the revision the browser loaded (null for a brand-new
     * city); a save from a tab that fell behind is refused rather than
     * overwriting newer progress.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maxBytes = (int) config('games.max_save_kb') * 1024;

        return [
            'revision' => ['present', 'nullable', 'integer', 'min:1'],
            'epoch' => ['required', 'integer', 'min:0', 'max:20'],
            'year' => ['required', 'integer', 'min:1000', 'max:3000'],
            'population' => ['required', 'integer', 'min:0', 'max:10000000'],
            'score' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'state' => [
                'required',
                'array',
                function (string $attribute, mixed $value, Closure $fail) use ($maxBytes): void {
                    if (strlen((string) json_encode($value)) > $maxBytes) {
                        $fail(__('games::messages.save_too_large'));
                    }
                },
            ],
        ];
    }
}
