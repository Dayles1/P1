<?php

namespace App\Domain\Chat\Models;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SoftDeletes;

    /**
     * How many members other than the sender have read this message — set
     * by MessageHydrator for a whole page at once (not a column).
     */
    public ?int $readCount = null;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'parent_message_id',
        'type',
        'body',
        'meta',
        'edited_at',
        'deleted_at',
        'is_pinned',
        'pinned_at',
        'pinned_by',
    ];

    /** An ordinary message: text and/or attachments. */
    public const TYPE_TEXT = 'text';

    /** A service line ("Alisher pinned a message"); `meta.system` says what happened. */
    public const TYPE_SYSTEM = 'system';

    /** A poll; `meta.poll` holds the question and options. */
    public const TYPE_POLL = 'poll';

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'edited_at' => 'datetime',
            'deleted_at' => 'datetime',
            'is_pinned' => 'boolean',
            'pinned_at' => 'datetime',
        ];
    }

    public function isSystem(): bool
    {
        return $this->type === self::TYPE_SYSTEM;
    }

    public function isPoll(): bool
    {
        return $this->type === self::TYPE_POLL;
    }

    /**
     * Who reacted with what, from the loaded `reactions`, in the order the
     * emoji were first used.
     *
     * @return array<int, array{emoji: string, count: int, user_ids: array<int, int>}>
     */
    public function reactionSummary(): array
    {
        return $this->reactions
            ->sortBy('id')
            ->groupBy('emoji')
            ->map(fn ($group, $emoji): array => [
                'emoji' => (string) $emoji,
                'count' => $group->count(),
                'user_ids' => $group->pluck('user_id')->map(fn ($id): int => (int) $id)->values()->all(),
            ])
            ->values()
            ->all();
    }

    /** @return BelongsTo<User, $this> */
    public function pinnedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pinned_by');
    }

    /**
     * Earlier versions of this message, oldest first.
     *
     * @return HasMany<MessageEdit, $this>
     */
    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class)->orderBy('id');
    }

    /**
     * Members who deleted this message for themselves.
     *
     * @return HasMany<MessageUserHide, $this>
     */
    public function hides(): HasMany
    {
        return $this->hasMany(MessageUserHide::class);
    }

    /** @return HasMany<PollVote, $this> */
    public function pollVotes(): HasMany
    {
        return $this->hasMany(PollVote::class);
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Message, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_message_id');
    }

    /** @return HasMany<Message, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_message_id');
    }

    /** @return HasMany<MessageAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }

    /** @return HasMany<MessageReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    /** @return HasMany<MessageRead, $this> */
    public function reads(): HasMany
    {
        return $this->hasMany(MessageRead::class);
    }
}
