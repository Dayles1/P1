<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\ManagePoll;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StorePollRequest;
use App\Http\Requests\Chat\VotePollRequest;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PollController extends Controller
{
    public function __construct(
        protected ManagePoll $polls,
    ) {}

    public function store(StorePollRequest $request, int $conversation): JsonResponse
    {
        $message = $this->polls->create($request->user(), $conversation, $request->validated());

        return $this->success(
            new MessageResource($message),
            __('messages.chat.message_sent'),
            $message->wasRecentlyCreated ? 201 : 200,
        );
    }

    public function vote(VotePollRequest $request, int $conversation, int $message): JsonResponse
    {
        return $this->success(new MessageResource(
            $this->polls->vote($request->user(), $conversation, $message, $request->validated('option_ids')),
        ));
    }

    public function retract(Request $request, int $conversation, int $message): JsonResponse
    {
        return $this->success(new MessageResource(
            $this->polls->retract($request->user(), $conversation, $message),
        ));
    }

    public function close(Request $request, int $conversation, int $message): JsonResponse
    {
        return $this->success(new MessageResource(
            $this->polls->close($request->user(), $conversation, $message),
        ));
    }
}
