<?php

namespace App\Domain\Identity\Models;

use Database\Factories\RequestLogFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestLog extends Model
{
    /** @use HasFactory<RequestLogFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_session_id',
        'user_id',
        'method',
        'path',
        'route_name',
        'status_code',
        'query',
        'headers',
        'body',
        'body_truncated',
        'response_headers',
        'response_body',
        'response_truncated',
        'ip_address',
        'user_agent',
        'duration_ms',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'query' => 'array',
            'headers' => 'array',
            'body' => 'array',
            'body_truncated' => 'boolean',
            'response_headers' => 'array',
            'response_body' => 'array',
            'response_truncated' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(UserSession::class, 'user_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function newFactory(): RequestLogFactory
    {
        return RequestLogFactory::new();
    }
}
