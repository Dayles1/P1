<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Events\UserTyping;
use App\Domain\Chat\Services\ChatAccess;
use App\Http\Controllers\Controller;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TypingController extends Controller
{
    /**
     * "… is typing / recording a voice message / sending a file" — a
     * fire-and-forget broadcast to the other members, nothing is stored.
     */
    public function store(Request $request, int $conversation, ChatAccess $access): JsonResponse
    {
        $kind = $request->validate([
            'kind' => ['nullable', Rule::in(UserTyping::KINDS)],
        ])['kind'] ?? 'typing';

        $user = $request->user();
        $membership = $access->membership($user, $conversation);

        if ($access->canPost($membership)) {
            $recipients = array_values(array_filter(
                $access->memberIds($conversation),
                fn (int $id): bool => $id !== (int) $user->id,
            ));

            LiveUpdates::toOthers(new UserTyping($recipients, $conversation, (int) $user->id, $user->name, $kind));
        }

        return $this->success();
    }
}
