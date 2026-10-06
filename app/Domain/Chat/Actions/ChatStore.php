<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\ConversationActivity;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\ChatNotifier;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\DB;

class ChatStore
{
    public function __construct(
        protected FindOrCreateSavedConversation $savedConversation,
        protected SystemMessages $systemMessages,
        protected ChatNotifier $notifier,
    ) {}

    /**
     * Starts a conversation. A private chat is unique per pair — asking
     * again (from either side) returns the existing one, and a private chat
     * with yourself is your Saved Messages.
     *
     * @param  array<string, mixed>  $data  validated ChatStoreRequest input
     */
    public function handle(User $creator, array $data): Conversation
    {
        $userIds = array_map('intval', (array) ($data['user_ids'] ?? []));

        if ($data['type'] === Conversation::TYPE_PRIVATE) {
            $otherId = $userIds[0] ?? 0;

            return $otherId === (int) $creator->id
                ? $this->savedConversation->handle($creator)
                : $this->privateConversation($creator, $otherId);
        }

        $memberIds = collect($userIds)
            ->unique()
            ->reject(fn (int $id): bool => $id === (int) $creator->id)
            ->values()
            ->all();

        $conversation = DB::transaction(function () use ($creator, $data, $memberIds): Conversation {
            $conversation = Conversation::query()->create([
                'type' => $data['type'],
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'created_by' => $creator->id,
            ]);

            $this->addMembers($conversation, $creator, $memberIds);

            return $conversation;
        });

        $this->systemMessages->post($conversation, $creator, SystemMessages::GROUP_CREATED, [
            'title' => (string) $conversation->title,
        ]);

        if ($memberIds !== []) {
            LiveUpdates::toEveryone(new ConversationActivity($memberIds, $conversation->id, ConversationActivity::REASON_JOINED));
            $this->notifier->membersAdded($creator, $conversation, $memberIds);
        }

        return $conversation;
    }

    /**
     * Finds or creates the pair's private chat. Both users' rows are locked
     * first, so A→B and B→A at the same moment still make one chat. A chat
     * one of them once left (before "delete" stopped meaning "leave") is
     * reused and they are brought back into it.
     */
    private function privateConversation(User $creator, int $otherId): Conversation
    {
        [$conversation, $created] = DB::transaction(function () use ($creator, $otherId): array {
            User::query()->whereKey([min($creator->id, $otherId), max($creator->id, $otherId)])
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $existingId = ConversationUser::query()
                ->join('conversations', 'conversations.id', '=', 'conversation_users.conversation_id')
                ->where('conversations.type', Conversation::TYPE_PRIVATE)
                ->whereIn('conversation_users.user_id', [$creator->id, $otherId])
                ->groupBy('conversation_users.conversation_id')
                ->havingRaw('count(distinct conversation_users.user_id) = 2')
                ->orderBy('conversation_users.conversation_id')
                ->value('conversation_users.conversation_id');

            if ($existingId !== null) {
                ConversationUser::query()
                    ->where('conversation_id', $existingId)
                    ->whereIn('user_id', [$creator->id, $otherId])
                    ->whereNotNull('left_at')
                    ->update(['left_at' => null, 'is_hidden' => false, 'joined_at' => now()]);

                return [Conversation::query()->whereKey($existingId)->firstOrFail(), false];
            }

            $conversation = Conversation::query()->create([
                'type' => Conversation::TYPE_PRIVATE,
                'created_by' => $creator->id,
            ]);

            $this->addMembers($conversation, $creator, [$otherId]);

            return [$conversation, true];
        });

        if ($created) {
            LiveUpdates::toEveryone(new ConversationActivity([$otherId], $conversation->id, ConversationActivity::REASON_JOINED));
        }

        return $conversation;
    }

    /**
     * @param  array<int, int>  $memberIds
     */
    private function addMembers(Conversation $conversation, User $creator, array $memberIds): void
    {
        $now = now();

        ConversationUser::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $creator->id,
            'role' => ConversationUser::ROLE_CREATOR,
            'joined_at' => $now,
        ]);

        if ($memberIds === []) {
            return;
        }

        DB::table('conversation_users')->insert(array_map(fn (int $id): array => [
            'conversation_id' => $conversation->id,
            'user_id' => $id,
            'role' => ConversationUser::ROLE_MEMBER,
            'joined_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ], $memberIds));
    }
}
