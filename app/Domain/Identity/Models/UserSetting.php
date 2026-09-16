<?php

namespace App\Domain\Identity\Models;

use App\Domain\Setting\Models\Timezone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'require_login_verification',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'require_login_verification' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Timezone, $this> */
    public function timezone(): BelongsTo
    {
        return $this->belongsTo(Timezone::class);
    }
}
