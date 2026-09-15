<?php

namespace App\Domain\Setting\Actions;

use App\Domain\Setting\Models\Setting;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;

class StoreFavicon
{
    public const SETTING_KEY = 'system.favicon';

    public const DEFAULT_PATH = '/favicon.ico';

    public function __construct(
        protected FileStorage $fileStorage,
        protected UpdateSettingAction $updateSetting,
    ) {}

    public function handle(UploadedFile $file): string
    {
        $setting = Setting::query()->byKey(self::SETTING_KEY)->firstOrFail();
        $previous = (string) $setting->typed_value;

        $stored = $this->fileStorage->store($file, 'favicons', 'public');
        $url = $this->fileStorage->url($stored['path'], 'public');

        $this->updateSetting->handle($setting, ['value' => $url]);

        DestroyFavicon::deleteIfUploaded($this->fileStorage, $previous);

        return $url;
    }
}
