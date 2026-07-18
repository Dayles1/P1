<?php

namespace App\Http\Requests\Setting;


use App\Domain\Setting\Models\Setting;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Setting|null $setting */
        $setting = $this->route('setting');

        if (! $setting instanceof Setting) {
            return [
                'value' => ['required'],
                'operation' => ['nullable', Rule::in(['set'])],
            ];
        }

        $operationRules = ['nullable', Rule::in(['set'])];
        $valueRules = ['required'];

        if ($setting->type === Setting::TYPE_BOOLEAN) {
            $operationRules = ['nullable', Rule::in(['set', 'toggle'])];
            $valueRules = ['nullable', 'boolean'];
        }

        if ($setting->type === Setting::TYPE_INTEGER) {
            $operationRules = ['nullable', Rule::in(['set', 'increment', 'decrement'])];
            $valueRules = ['nullable', 'integer'];
        }

        if ($setting->type === Setting::TYPE_JSON) {
            $operationRules = ['nullable', Rule::in(['set'])];
            $valueRules = ['required', 'array'];
        }

        if (in_array($setting->type, [Setting::TYPE_STRING, Setting::TYPE_TEXT], true)) {
            $operationRules = ['nullable', Rule::in(['set'])];
            $valueRules = ['required', 'string'];
        }

        return [
            'value' => $valueRules,
            'operation' => $operationRules,
        ];
    }
}