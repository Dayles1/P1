<?php

namespace App\Domain\Chat\Models;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class Conversation extends Model
{
    protected $fillable = [
        'type',
        'title',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationUser::class);
    }

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
                'is_pinned',
                'is_hidden',
                'unread_count',
                'notifications_enabled',
            ])
            ->withTimestamps();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * The conversation's uploaded avatar attachment. Not named `avatar()` —
     * the model already has a real `avatar` column (a plain URL string), and
     * an Eloquent relation method sharing that name would never actually be
     * reachable through `$conversation->avatar` (the column always wins).
     */
    public function avatarAttachment(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')
            ->where('collection', 'avatar');
    }
}
