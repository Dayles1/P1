<?php

namespace App\Domain\Chat\Models;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/**
 * @property-read ConversationUser|null $pivot the viewer's membership, when loaded through `User::conversations()`
 */
class Conversation extends Model
{
    public const TYPE_PRIVATE = 'private';

    public const TYPE_GROUP = 'group';

    public const TYPE_CHANNEL = 'channel';

    /** "Saved Messages": a chat with only its owner in it. */
    public const TYPE_SAVED = 'saved';

    /**
     * Per-viewer facts for the chat list (the other person in a private
     * chat, blocks, …), filled by ConversationPresenter — not a column.
     *
     * @var array<string, mixed>|null
     */
    public ?array $viewerContext = null;

    protected $fillable = [
        'type',
        'title',
        'description',
        'created_by',
        'last_message_id',
        'last_message_at',
        'is_locked',
        'is_archived',
        'is_pinned',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'is_locked' => 'boolean',
            'is_archived' => 'boolean',
            'is_pinned' => 'boolean',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Message, $this> */
    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    /** @return HasMany<ConversationUser, $this> */
    public function participants(): HasMany
    {
        return $this->hasMany(ConversationUser::class);
    }

    /** @return BelongsToMany<User, $this, ConversationUser> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'conversation_users'
        )
            ->using(ConversationUser::class)
            ->wherePivotNull('left_at')
            ->withPivot([
                'role',
                'joined_at',
                'left_at',
                'muted_until',
                'last_read_message_id',
                'last_read_at',
                'cleared_up_to_message_id',
                'is_pinned',
                'pinned_at',
                'is_hidden',
                'archived_at',
                'unread_count',
                'marked_unread',
                'notifications_enabled',
            ])
            ->withTimestamps();
    }

    public function isGroupLike(): bool
    {
        return in_array($this->type, [self::TYPE_GROUP, self::TYPE_CHANNEL], true);
    }

    /**
     * The uploaded photo's URL, else the legacy `avatar` URL column.
     */
    public function avatarUrl(): ?string
    {
        return $this->avatarAttachment->url ?? $this->avatar;
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * The conversation's uploaded avatar attachment. Not named `avatar()` —
     * the model already has a real `avatar` column (a plain URL string), and
     * an Eloquent relation method sharing that name would never actually be
     * reachable through `$conversation->avatar` (the column always wins).
     *
     * @return MorphOne<Attachment, $this>
     */
    public function avatarAttachment(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')
            ->where('collection', 'avatar');
    }
}
