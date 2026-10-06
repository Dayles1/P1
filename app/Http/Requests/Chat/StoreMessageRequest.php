<?php

namespace App\Http\Requests\Chat;

use App\Domain\Setting\Services\SettingService;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

class StoreMessageRequest extends FormRequest
{
    /**
     * What browsers' MediaRecorder produces for a voice message. Accepted on
     * top of the admin's extension list: `mimes` goes by the extension the
     * MIME type maps to (audio/webm → "weba", audio/ogg → "oga"), which
     * that list rarely spells.
     *
     * @var array<int, string>
     */
    public const VOICE_MIME_TYPES = [
        'audio/webm',
        'audio/ogg',
        'audio/opus',
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/vnd.wave',
    ];

    /**
     * What a server's file sniffing calls such a recording: an audio-only
     * WebM or MP4 reads as "video/webm" / "video/mp4", Ogg as
     * "application/ogg". Taken as a voice message only when the browser
     * itself sent the file as audio, with an audio file extension.
     *
     * @var array<int, string>
     */
    public const VOICE_CONTAINER_MIME_TYPES = [
        'video/webm',
        'video/mp4',
        'video/ogg',
        'application/ogg',
        'application/octet-stream',
    ];

    /**
     * Extensions a browser recording arrives with. A file the server cannot
     * identify (or calls a video container) passes as a voice message only
     * with one of these — not merely because the client labelled it audio.
     *
     * @var array<int, string>
     */
    public const VOICE_EXTENSIONS = ['webm', 'weba', 'ogg', 'oga', 'opus', 'mp3', 'm4a', 'mp4', 'aac', 'wav'];

    /**
     * Whether `$file` is a voice message recorded in the browser.
     */
    public static function isVoiceRecording(UploadedFile $file): bool
    {
        if (self::isActiveContent($file)) {
            return false;
        }

        $detected = (string) $file->getMimeType();

        if (in_array($detected, self::VOICE_MIME_TYPES, true)) {
            return true;
        }

        return str_starts_with((string) $file->getClientMimeType(), 'audio/')
            && in_array($detected, self::VOICE_CONTAINER_MIME_TYPES, true)
            && in_array(strtolower($file->getClientOriginalExtension()), self::VOICE_EXTENSIONS, true);
    }

    /**
     * The audio type a voice recording is stored under (so it plays as
     * one), whatever the sniffing said; null for any other file.
     */
    public static function voiceMimeType(UploadedFile $file): ?string
    {
        if (! self::isVoiceRecording($file)) {
            return null;
        }

        $detected = (string) $file->getMimeType();

        return str_starts_with($detected, 'audio/')
            ? $detected
            : (strtok((string) $file->getClientMimeType(), ';') ?: null);
    }

    /**
     * Active content (SVG, HTML, scripts, executables) that a browser would
     * run from the app's own origin — never accepted, whatever the admin's
     * extension list says.
     */
    public static function isActiveContent(UploadedFile $file): bool
    {
        $blockedExtensions = config('chat.blocked_extensions', []);
        $extensions = array_filter([
            strtolower($file->getClientOriginalExtension()),
            strtolower((string) $file->guessExtension()),
        ]);

        if (array_intersect($extensions, $blockedExtensions) !== []) {
            return true;
        }

        $mimeTypes = array_filter([
            strtolower((string) $file->getMimeType()),
            strtolower((string) strtok((string) $file->getClientMimeType(), ';')),
        ]);

        return array_intersect($mimeTypes, config('chat.blocked_mime_types', [])) !== [];
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $settings = app(SettingService::class);
        $maxSize = $settings->integer('upload.max_upload_size', 10240);
        $extensions = $settings->json('upload.allowed_extensions', []);

        if ($extensions === []) {
            $extensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4'];
        }

        $extensions = array_values(array_diff($extensions, config('chat.blocked_extensions', [])));

        return [
            // A message needs either text or at least one attachment, not necessarily both.
            'body' => ['nullable', 'string', 'max:5000', 'required_without:attachments'],
            // Only a message of this same conversation can be quoted.
            'parent_message_id' => [
                'nullable',
                'integer',
                Rule::exists('messages', 'id')
                    ->where('conversation_id', (int) $this->route('conversation'))
                    ->whereNull('deleted_at'),
            ],
            // Generated by the client per message (a UUID), so a retried send is recognised.
            'client_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => [
                'file',
                'max:'.$maxSize,
                $this->allowedFileType($extensions),
            ],
            'attachment_meta' => ['nullable', 'array', 'max:10'],
            'attachment_meta.*.duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
            'attachment_meta.*.voice' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<int, string>  $extensions
     */
    private function allowedFileType(array $extensions): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($extensions): void {
            if (! $value instanceof UploadedFile) {
                return;
            }

            if (self::isActiveContent($value)) {
                $fail('validation.mimes')->translate(['values' => implode(', ', $extensions)]);

                return;
            }

            $validator = validator(['file' => $value], ['file' => 'mimes:'.implode(',', $extensions)]);

            if ($validator->passes() || self::isVoiceRecording($value)) {
                return;
            }

            $fail('validation.mimes')->translate(['values' => implode(', ', $extensions)]);
        };
    }
}
