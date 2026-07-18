<?php

namespace App\Http\Requests\Profile;

use App\Domain\Setting\Services\SettingService;
use Illuminate\Foundation\Http\FormRequest;

class StoreAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }


    public function rules(): array
    {
        $setting = app(SettingService::class);

        $maxSize = $setting->integer('user.max_avatar_size', 5120);

        return [
            'file' => [
                'required',
                'file',
                'max:' . $maxSize,
                'mimes:jpg,jpeg,png,webp,gif,mp4,mov,avi,mkv',
            ],
        ];
    }
}