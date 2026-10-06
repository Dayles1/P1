<?php

namespace App\Domain\Chat\Models;

use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Pivot;

class ConversationUser extends Pivot
{
    protected $table = 'conversation_users';

    protected $fillable = [
        'conversation_id',
        'user_id',
        'role',
        'joined_at',
        'left_at',
        'muted_until',
        'unread_count',
        'last_read_message_id',
        'last_read_at',
        'cleared_up_to_message_id',
        'is_pinned',
        'pinned_at',
        'is_hidden',
        'archived_at',
        'marked_unread',
        'notifications_enabled',
    ];

    /** The group's owner (whoever created it, or got it handed over). */
    public const ROLE_CREATOR = 'creator';

    /** May rename the group, change its photo and manage members. */
    public const ROLE_ADMIN = 'admin';

    public const ROLE_MEMBER = 'member';

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
            'muted_until' => 'datetime',
            'last_read_at' => 'datetime',
            'is_pinned' => 'boolean',
            'pinned_at' => 'datetime',
            'is_hidden' => 'boolean',
            'archived_at' => 'datetime',
            'marked_unread' => 'boolean',
            'notifications_enabled' => 'boolean',
        ];
    }

    /** The creator or an admin: may manage the group. */
    public function isManager(): bool
    {
        return in_array($this->role, [self::ROLE_CREATOR, self::ROLE_ADMIN], true);
    }

    public function isMuted(): bool
    {
        return ! $this->notifications_enabled
            || ($this->muted_until !== null && $this->muted_until->isFuture());
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

    /** @return HasMany<ConversationUserPermission, $this> */
    public function permissions(): HasMany
    {
        // Explicit FK: Pivot's key-name resolution doesn't feed Eloquent's
        // usual class-name-based foreign key guessing the way a normal
        // Model's does, so the implicit hasMany() silently built a bogus
        // (empty) foreign key here.
        return $this->hasMany(ConversationUserPermission::class, 'conversation_user_id');
    }
}
