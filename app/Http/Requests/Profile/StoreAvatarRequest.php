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

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $setting = app(SettingService::class);

        $maxSize = $setting->integer('user.max_avatar_size', 5120);

        return [
            'file' => [
                'required',
                'file',
                'max:'.$maxSize,
                /*
                 * Only what a browser can show as an avatar: an animated
                 * GIF plays in an <img>, a short video (often what a "GIF"
                 * from Telegram or Giphy really is) loops in a muted <video>.
                 */
                'mimes:jpg,jpeg,png,webp,gif,mp4,webm,mov',
            ],
        ];
    }
}
