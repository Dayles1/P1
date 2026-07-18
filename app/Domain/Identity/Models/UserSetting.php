<?php

namespace App\Domain\Identity\Models;

use App\Domain\Setting\Models\Timezone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class UserSetting extends Model
{
    protected $fillable = [
        'user_id',
        'timezone_id',
        'timezone_source',
        'locale',
        'theme',
        'date_format',
        'time_format',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function timezone(): BelongsTo
    {
        return $this->belongsTo(Timezone::class);
    }
}