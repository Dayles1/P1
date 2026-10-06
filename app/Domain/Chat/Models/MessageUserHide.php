<?php

namespace App\Domain\Chat\Models;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A message one member deleted for themselves only ("Delete for me").
 */
class MessageUserHide extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'message_id',
        'user_id',
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
