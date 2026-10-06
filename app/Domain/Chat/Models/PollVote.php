<?php

namespace App\Domain\Chat\Models;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A vote for one option of a poll message. `option_id` is the option's
 * index in the message's `meta.poll.options`.
 */
class PollVote extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'message_id',
        'user_id',
        'option_id',
    ];

    protected function casts(): array
    {
        return [
            'option_id' => 'integer',
        ];
    }

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
