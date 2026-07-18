<?php

namespace App\Domain\Chat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationUserPermission extends Model
{
    protected $fillable = [
        'conversation_user_id',
        'permission_key',
        'is_allowed',
    ];

    protected function casts(): array
    {
        return [
            'is_allowed' => 'boolean',
        ];
    }

    public function conversationUser(): BelongsTo
    {
        return $this->belongsTo(ConversationUser::class);
    }
}