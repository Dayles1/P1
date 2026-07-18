<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

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
            ],

            'theme' => [
                'nullable',
                'in:light,dark,system',
            ],

            'date_format' => [
                'nullable',
                'string',
                'max:50',
            ],

            'time_format' => [
                'nullable',
                'string',
                'max:50',
            ],

            'meta' => [
                'nullable',
                'array',
            ],
        ];
    }
}