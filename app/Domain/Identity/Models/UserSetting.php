<?php

namespace App\Domain\Identity\Models;

use App\Domain\Currency\Models\Currency;
use App\Domain\Setting\Models\Timezone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSetting extends Model
{
    protected $fillable = [
        'user_id',
        'timezone_id',
        'timezone_source',
        'preferred_currency_id',
        'favorite_currency_ids',
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
            'favorite_currency_ids' => 'array',
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

    /**
     * The currency this user reads prices in and prices things with.
     * Null means the app currency — see CurrencyConverter::preferredCode().
     *
     * @return BelongsTo<Currency, $this>
     */
    public function preferredCurrency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'preferred_currency_id');
    }
}
