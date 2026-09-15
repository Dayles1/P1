<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\DeleteMessage;
use App\Domain\Chat\Actions\EditMessage;
use App\Domain\Chat\Actions\ListMessages;
use App\Domain\Chat\Actions\MarkMessageRead;
use App\Domain\Chat\Actions\PinMessage;
use App\Domain\Chat\Actions\SearchMessages;
use App\Domain\Chat\Actions\SendMessage;
use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Chat\Actions\UnpinMessage;
use App\Domain\Chat\Models\Message;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Http\Requests\Chat\ToggleReactionRequest;
use App\Http\Requests\Chat\UpdateMessageRequest;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function __construct(
        protected SendMessage $sendMessage,
        protected ListMessages $listMessages,
        protected EditMessage $editMessage,
        protected DeleteMessage $deleteMessage,
        protected ToggleMessageReaction $toggleMessageReaction,
        protected MarkMessageRead $markMessageRead,
        protected PinMessage $pinMessage,
        protected UnpinMessage $unpinMessage,
        protected SearchMessages $searchMessages,
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

    public function update(UpdateMessageRequest $request, int $conversation, int $message): JsonResponse
    {
        $updated = $this->editMessage->handle(
            $request->user(),
            $conversation,
            $message,
            $request->validated('body')
        );

        return $this->success(
            new MessageResource($updated),
            __('messages.chat.message_updated')
        );
    }

    public function destroy(Request $request, int $conversation, int $message): JsonResponse
    {
        $this->deleteMessage->handle($request->user(), $conversation, $message);

        return $this->success(message: __('messages.chat.message_deleted'));
    }

    public function react(ToggleReactionRequest $request, int $conversation, int $message): JsonResponse
    {
        $reactions = $this->toggleMessageReaction->handle(
            $request->user(),
            $conversation,
            $message,
            $request->validated('emoji')
        );

        return $this->success(data: ['reactions' => $reactions]);
    }

    public function markRead(Request $request, int $conversation, int $message): JsonResponse
    {
        $this->markMessageRead->handle($request->user(), $conversation, $message);

        return $this->success(message: __('messages.chat.message_read'));
    }

    public function pin(Request $request, int $conversation, int $message): JsonResponse
    {
        $pinned = $this->pinMessage->handle($request->user(), $conversation, $message);

        return $this->success(new MessageResource($pinned), __('messages.chat.message_pinned'));
    }

    public function unpin(Request $request, int $conversation, int $message): JsonResponse
    {
        $unpinned = $this->unpinMessage->handle($request->user(), $conversation, $message);

        return $this->success(new MessageResource($unpinned), __('messages.chat.message_unpinned'));
    }

    public function pinned(Request $request, int $conversation): JsonResponse
    {
        $request->user()->conversations()->findOrFail($conversation);

        $messages = Message::query()
            ->where('conversation_id', $conversation)
            ->where('is_pinned', true)
            ->with(['user.avatar'])
            ->latest('pinned_at')
            ->get();

        return $this->success(data: MessageResource::collection($messages));
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:200'],
            'conversation_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $results = $this->searchMessages->handle(
            $request->user(),
            $data['q'],
            $data['conversation_id'] ?? null,
            $data['per_page'] ?? 20,
        );

        return $this->responsePagination($results, MessageResource::collection($results));
    }
}
