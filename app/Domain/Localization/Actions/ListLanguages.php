<?php

namespace App\Domain\Localization\Actions;

use App\Domain\Localization\Models\Language;
use Illuminate\Database\Eloquent\Collection;

class ListLanguages
{
    public function handle(): Collection
    {
        return Language::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();
    }
}
