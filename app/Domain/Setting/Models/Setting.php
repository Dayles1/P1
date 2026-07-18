<?php

namespace App\Domain\Setting\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    public const TYPE_BOOLEAN = 'boolean';
    public const TYPE_INTEGER = 'integer';
    public const TYPE_JSON    = 'json';
    public const TYPE_STRING  = 'string';
    public const TYPE_TEXT    = 'text';

    public const GROUP_AUTH          = 'auth';
    public const GROUP_SYSTEM        = 'system';
    public const GROUP_LOCALIZATION  = 'localization';
    public const GROUP_UPLOAD        = 'upload';
    public const GROUP_NOTIFICATION  = 'notification';
    public const GROUP_USER          = 'user';
    public const GROUP_SECURITY      = 'security';

    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'is_public',
        'is_locked',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_locked' => 'boolean',
        ];
    }

    public function getTypedValueAttribute(): mixed
    {
        return self::castValue($this->value, $this->type);
    }

    public function scopeByKey(Builder $query, string $key): Builder
    {
        return $query->where('key', $key);
    }

    public function scopeByGroup(Builder $query, string $group): Builder
    {
        return $query->where('group', $group);
    }

    public static function castValue(mixed $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            self::TYPE_BOOLEAN => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            self::TYPE_INTEGER => (int) $value,
            self::TYPE_JSON    => is_string($value)
                ? json_decode($value, true)
                : $value,
            self::TYPE_TEXT,
            self::TYPE_STRING  => (string) $value,
            default            => $value,
        };
    }

    public static function normalizeValue(mixed $value, string $type): string|int|float|bool|null
    {
        return match ($type) {
            self::TYPE_BOOLEAN => filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0,
            self::TYPE_INTEGER => (int) $value,
            self::TYPE_JSON    => json_encode(
                $value,
                JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
            ),
            self::TYPE_TEXT,
            self::TYPE_STRING  => (string) $value,
            default            => $value,
        };
    }
}