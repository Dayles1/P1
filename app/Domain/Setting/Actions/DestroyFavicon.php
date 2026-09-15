<?php

namespace App\Domain\Setting\Actions;

use App\Domain\Setting\Models\Setting;
use App\Infrastructure\Storage\FileStorage;

class DestroyFavicon
{
    public function __construct(
        protected FileStorage $fileStorage,
        protected UpdateSettingAction $updateSetting,
    ) {}

    public function handle(): string
    {
        $setting = Setting::query()->byKey(StoreFavicon::SETTING_KEY)->firstOrFail();
        $previous = (string) $setting->typed_value;

        $this->updateSetting->handle($setting, ['value' => StoreFavicon::DEFAULT_PATH]);

        self::deleteIfUploaded($this->fileStorage, $previous);

        return StoreFavicon::DEFAULT_PATH;
    }

    /** Only ever deletes files this app itself uploaded — never the static default asset. */
    public static function deleteIfUploaded(FileStorage $fileStorage, string $value): void
    {
        $prefix = '/storage/favicons/';

        if (! str_starts_with($value, $prefix)) {
            return;
        }

        $fileStorage->delete(substr($value, strlen('/storage/')), 'public');
    }
}
