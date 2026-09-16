<?php

namespace App\Domain\Audit\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Audit extends Model
{
    protected $fillable = [
        'causer_type',
        'causer_id',
        'subject_type',
        'subject_id',
        'event',
        'title',
        'description',
        'old_values',
        'new_values',
        'meta',
        'ip_address',
        'user_agent',
        'url',
        'method',
        'route_name',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'meta' => 'array',
        ];
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function causer(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
