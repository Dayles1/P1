<?php

namespace App\Domain\Organization\Models;

use App\Domain\Ban\Models\Ban;
use App\Domain\Identity\Models\User;
use App\Domain\Localization\Traits\HasTranslations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class Department extends Model
{
    use HasTranslations;

    protected $fillable = [
        'code',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
    public function ban(): MorphOne
    {
        return $this->morphOne(Ban::class, 'bannable');
    }

    public function isBanned(): bool
    {
        return $this->ban?->isActive() ?? false;
    }
}