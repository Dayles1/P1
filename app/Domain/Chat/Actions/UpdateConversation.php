<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;
use Illuminate\Validation\ValidationException;

class UpdateConversation
{
    public function handle(User $user, Conversation $conversation, array $data): Conversation
    {
        $this->ensureCanManage($user, $conversation);

        if (! in_array($conversation->type, ['group', 'channel'], true)) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.cannot_update_private_chat'),
            ]);
        }

        $conversation->update([
            'title' => $data['title'] ?? $conversation->title,
            'meta'   => $data['meta'] ?? $conversation->meta,
        ]);

        return $conversation->refresh();
    }

    protected function ensureCanManage(User $user, Conversation $conversation): void
    {
        $pivot = $conversation->participants()
            ->where('user_id', $user->id)
            ->first();

        if (! $pivot) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_a_member'),
            ]);
        }

        if ($pivot->role !== 'creator') {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_allowed'),
            ]);
        }
    }
}