<?php

namespace App\Http\Requests\Chat;

use App\Domain\Setting\Services\SettingService;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $settings = app(SettingService::class);
        $maxSize = $settings->integer('upload.max_upload_size', 10240);
        $extensions = implode(',', $settings->json('upload.allowed_extensions', []));

        return [
            // A message needs either text or at least one attachment, not necessarily both.
            'body' => ['nullable', 'string', 'max:5000', 'required_without:attachments'],
            'parent_message_id' => ['nullable', 'integer', 'exists:messages,id'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => [
                'file',
                'max:'.$maxSize,
                $extensions !== '' ? 'mimes:'.$extensions : 'mimes:jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,mp4',
            ],
        ];
    }
}
