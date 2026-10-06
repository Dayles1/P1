<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The member's own settings for a chat: mute (for a while or for good),
 * archive, pin (at most `chat.max_pinned_conversations`), marked unread.
 * The member's other devices hear about it (`conversation.settings`).
 */
class UpdateConversationSettings
{
    public const MUTE_DURATIONS = [
        '1h' => 60,
        '8h' => 480,
        '1d' => 1440,
        '3d' => 4320,
    ];

    public function __construct(
        private readonly ChatAccess $access,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    /**
     * @param  array{mute?: string|null, archived?: bool|null, marked_unread?: bool|null, pinned?: bool|null}  $data
     */
    public function handle(User $user, int $conversationId, array $data): ConversationUser
    {
        $this->access->membership($user, $conversationId);

        DB::transaction(function () use ($user, $conversationId, $data): void {
            $membership = ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            $changes = [];

            if (isset($data['mute'])) {
                $changes += match ($data['mute']) {
                    'off' => ['muted_until' => null, 'notifications_enabled' => true],
                    'forever' => ['muted_until' => null, 'notifications_enabled' => false],
                    default => ['muted_until' => now()->addMinutes(self::MUTE_DURATIONS[$data['mute']]), 'notifications_enabled' => true],
                };
            }

            if (isset($data['archived'])) {
                $changes['archived_at'] = $data['archived'] ? ($membership->archived_at ?? now()) : null;

                // Archiving unpins, as in Telegram.
                if ($data['archived']) {
                    $changes['is_pinned'] = false;
                    $changes['pinned_at'] = null;
                }
            }

            if (isset($data['marked_unread'])) {
                $changes['marked_unread'] = (bool) $data['marked_unread'];
            }

            if (isset($data['pinned'])) {
                $changes += $this->pinChanges($user, $membership, (bool) $data['pinned']);
            }

            if ($changes !== []) {
                $membership->update($changes);
            }
        });

        $this->broadcaster->settings($user, $conversationId);

        return ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function pinChanges(User $user, ConversationUser $membership, bool $pinned): array
    {
        if (! $pinned) {
            return ['is_pinned' => false, 'pinned_at' => null];
        }

        if ($membership->is_pinned) {
            return [];
        }

        // Locks the member's pinned rows, so two pins at once cannot both
        // squeeze under the limit.
        $pinnedCount = ConversationUser::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where('is_pinned', true)
            ->lockForUpdate()
            ->count();

        if ($pinnedCount >= (int) config('chat.max_pinned_conversations', 10)) {
            throw ValidationException::withMessages([
                'pinned' => __('messages.chat.max_pinned_reached'),
            ]);
        }

        return ['is_pinned' => true, 'pinned_at' => now(), 'archived_at' => null];
    }
}
