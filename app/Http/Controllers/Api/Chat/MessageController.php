<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\ListMessages;
use App\Domain\Chat\Actions\SendMessage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function __construct(
        protected SendMessage $sendMessage,
        protected ListMessages $listMessages,
    ) {}

    public function index(Request $request, int $conversation): JsonResponse
    {
        $filters = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $messages = $this->listMessages->handle($request->user(), $conversation, $filters);

        return $this->responsePagination(
            $messages,
            MessageResource::collection($messages)
        );
    }

    public function store(StoreMessageRequest $request, int $conversation): JsonResponse
    {
        $message = $this->sendMessage->handle(
            $request->user(),
            $conversation,
            $request->validated()
        );

        return $this->success(
            new MessageResource($message),
            __('messages.chat.message_sent'),
            201
        );
    }
}
