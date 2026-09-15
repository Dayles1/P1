<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Events\UserTyping;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TypingController extends Controller
{
    public function store(Request $request, int $conversation): JsonResponse
    {
        $user = $request->user();

        // Cheap membership check — no separate action class needed for a
        // fire-and-forget broadcast with nothing to persist.
        $user->conversations()->findOrFail($conversation);

        broadcast(new UserTyping($conversation, $user->id, $user->name))->toOthers();

        return $this->success();
    }
}
