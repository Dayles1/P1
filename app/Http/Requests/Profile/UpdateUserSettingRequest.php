<?php

namespace App\Http\Requests\Profile;

use App\Domain\Localization\Models\Language;
use App\Domain\Setting\Services\ThemeCatalog;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'timezone_id' => [
                'nullable',
                'exists:timezones,id',
            ],

            'timezone_source' => [
                'nullable',
                'string',
                'max:50',
            ],

            'locale' => [
                'nullable',
                'string',
                'max:10',
                Rule::in(Language::query()->where('is_active', true)->pluck('code')->all()),
            ],

            'theme' => [
                'nullable',
                Rule::in(ThemeCatalog::codes()),
            ],

            'date_format' => [
                'nullable',
                Rule::in(array_keys(UserDateFormatter::availableDateFormats())),
            ],

            'time_format' => [
                'nullable',
                Rule::in(array_keys(UserDateFormatter::availableTimeFormats())),
            ],

            'meta' => [
                'nullable',
                'array',
            ],
        ];
    }
}
