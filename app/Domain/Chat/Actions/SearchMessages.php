<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

/**
 * Searches the messages the member can see — in all their chats or one —
 * by text, sender and date. Each hit carries its chat (`conversation`).
 */
class SearchMessages
{
    public function __construct(
        private readonly MessageHydrator $hydrator,
    ) {}

    /**
     * @param  array{q?: string|null, conversation_id?: int|null, sender_id?: int|null, date_from?: string|null, date_to?: string|null, per_page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Message>
     */
    public function handle(User $user, array $filters): LengthAwarePaginator
    {
        $memberships = ConversationUser::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->when($filters['conversation_id'] ?? null, fn ($query, $id) => $query->where('conversation_id', (int) $id))
            ->get(['conversation_id', 'cleared_up_to_message_id']);

        $query = Message::query()
            ->where(function ($scope) use ($memberships): void {
                $scope->whereIn('conversation_id', $memberships->whereNull('cleared_up_to_message_id')->pluck('conversation_id')->all());

                foreach ($memberships->whereNotNull('cleared_up_to_message_id') as $membership) {
                    $scope->orWhere(fn ($one) => $one
                        ->where('conversation_id', $membership->conversation_id)
                        ->where('id', '>', (int) $membership->cleared_up_to_message_id));
                }
            })
            ->where('type', '!=', Message::TYPE_SYSTEM)
            ->whereNotExists(fn ($hidden) => $hidden->selectRaw('1')
                ->from('message_user_hides')
                ->whereColumn('message_user_hides.message_id', 'messages.id')
                ->where('message_user_hides.user_id', $user->id));

        if (! empty($filters['q'])) {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], (string) $filters['q']).'%';
            $query->whereRaw("body like ? escape '!'", [$pattern]);
        }

        if (! empty($filters['sender_id'])) {
            $query->where('user_id', (int) $filters['sender_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }

        if (! empty($filters['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }

        $results = $query->with('conversation')->latest('id')->paginate((int) ($filters['per_page'] ?? 20));

        $page = new Collection($results->items());
        $this->hydrator->hydrate($page);
        $this->attachConversationTitles($page, $user);

        return $results;
    }

    /**
     * A private chat's title is the other person's name.
     *
     * @param  Collection<int, Message>  $messages
     */
    private function attachConversationTitles(Collection $messages, User $user): void
    {
        $privateIds = $messages->pluck('conversation')
            ->filter(fn (?Conversation $conversation): bool => $conversation?->type === Conversation::TYPE_PRIVATE)
            ->pluck('id')
            ->unique()
            ->values();

        $names = $privateIds->isEmpty() ? collect() : ConversationUser::query()
            ->join('users', 'users.id', '=', 'conversation_users.user_id')
            ->whereIn('conversation_users.conversation_id', $privateIds)
            ->where('conversation_users.user_id', '!=', $user->id)
            ->pluck('users.name', 'conversation_users.conversation_id');

        foreach ($messages as $message) {
            $conversation = $message->conversation;

            if ($conversation) {
                $conversation->viewerContext = [
                    'search_title' => $conversation->type === Conversation::TYPE_PRIVATE
                        ? ($names[$conversation->id] ?? null)
                        : $conversation->title,
                ];
            }
        }
    }
}
