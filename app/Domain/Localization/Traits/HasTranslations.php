<?php

namespace App\Domain\Localization\Traits;

use App\Domain\Localization\Models\Translation;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait HasTranslations
{
    public function translations(): MorphMany
    {
        return $this->morphMany(Translation::class, 'translatable');
    }

    public function getTranslation(string $field, ?string $locale = null, ?string $fallbackLocale = null): ?string
    {
        $locale ??= app()->getLocale();
        $fallbackLocale ??= config('app.fallback_locale');

        $translation = $this->translations()
            ->where('field', $field)
            ->where('locale', $locale)
            ->value('value');

        if ($translation !== null) {
            return $translation;
        }

        if ($fallbackLocale !== null && $fallbackLocale !== $locale) {
            return $this->translations()
                ->where('field', $field)
                ->where('locale', $fallbackLocale)
                ->value('value');
        }

        return null;
    }

    public function setTranslation(string $field, string $locale, string $value): void
    {
        $this->translations()->updateOrCreate(
            [
                'field' => $field,
                'locale' => $locale,
            ],
            [
                'value' => $value,
            ]
        );
    }
}