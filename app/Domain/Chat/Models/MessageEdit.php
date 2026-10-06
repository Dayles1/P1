<?php

namespace App\Domain\Chat\Models;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One edit of a message: who made it, when (`created_at`) and the text
 * the message had just before it.
 */
class MessageEdit extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'message_id',
        'user_id',
        'previous_body',
    ];

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
