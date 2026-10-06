<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\DeleteMessage;
use App\Domain\Chat\Actions\EditMessage;
use App\Domain\Chat\Actions\ForwardMessages;
use App\Domain\Chat\Actions\ListMessages;
use App\Domain\Chat\Actions\MarkMessageRead;
use App\Domain\Chat\Actions\PinMessage;
use App\Domain\Chat\Actions\SearchMessages;
use App\Domain\Chat\Actions\SendMessage;
use App\Domain\Chat\Actions\ShowMessageInfo;
use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageHydrator;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\DeleteMessagesRequest;
use App\Http\Requests\Chat\ForwardMessagesRequest;
use App\Http\Requests\Chat\ListMessagesRequest;
use App\Http\Requests\Chat\MarkConversationReadRequest;
use App\Http\Requests\Chat\SearchMessagesRequest;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Http\Requests\Chat\ToggleReactionRequest;
use App\Http\Requests\Chat\UpdateMessageRequest;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        protected SearchMessages $searchMessages,
    ) {}

    public function index(ListMessagesRequest $request, int $conversation): JsonResponse
    {
        $filters = $request->validated();
        $filters['limit'] ??= $filters['per_page'] ?? null;

        $window = $this->listMessages->handle($request->user(), $conversation, $filters);

        return $this->success(
            MessageResource::collection($window['messages']),
            meta: ['meta' => $window['meta']],
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
            // A retried send (same client_id) returns the original message.
            $message->wasRecentlyCreated ? 201 : 200
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
        $for = $request->validate([
            'for' => ['nullable', Rule::in([DeleteMessage::FOR_EVERYONE, DeleteMessage::FOR_ME])],
        ])['for'] ?? DeleteMessage::FOR_EVERYONE;

        $result = $this->deleteMessage->handle($request->user(), $conversation, [$message], $for, failWhenMissing: true);

        return $this->success($result, __('messages.chat.message_deleted'));
    }

    public function destroyMany(DeleteMessagesRequest $request, int $conversation): JsonResponse
    {
        $result = $this->deleteMessage->handle(
            $request->user(),
            $conversation,
            $request->validated('message_ids'),
            $request->validated('for') ?? DeleteMessage::FOR_EVERYONE,
        );

        return $this->success($result, __('messages.chat.message_deleted'));
    }

    public function forward(ForwardMessagesRequest $request, ForwardMessages $forwardMessages): JsonResponse
    {
        $results = $forwardMessages->handle(
            $request->user(),
            (int) $request->validated('from_conversation_id'),
            $request->validated('message_ids'),
            $request->validated('conversation_ids'),
            $request->validated('comment'),
            (bool) $request->validated('hide_sender'),
        );

        return $this->success([
            'conversations' => array_map(fn (array $result): array => [
                'conversation_id' => $result['conversation_id'],
                'messages' => MessageResource::collection($result['messages']),
            ], $results),
        ], __('messages.chat.message_sent'), 201);
    }

    public function info(Request $request, int $conversation, int $message, ShowMessageInfo $showMessageInfo): JsonResponse
    {
        return $this->success($showMessageInfo->handle($request->user(), $conversation, $message));
    }

    public function react(ToggleReactionRequest $request, int $conversation, int $message): JsonResponse
    {
        $result = $this->toggleMessageReaction->handle(
            $request->user(),
            $conversation,
            $message,
            $request->validated('emoji')
        );

        return $this->success(data: $result);
    }

    /**
     * Older endpoint: "read up to this message" — the same as `POST …/read {message_id}`.
     */
    public function markRead(Request $request, int $conversation, int $message): JsonResponse
    {
        $state = $this->markMessageRead->handle($request->user(), $conversation, $message);

        return $this->success($state, __('messages.chat.message_read'));
    }

    public function read(MarkConversationReadRequest $request, int $conversation): JsonResponse
    {
        $messageId = $request->validated('message_id');

        $state = $this->markMessageRead->handle($request->user(), $conversation, $messageId !== null ? (int) $messageId : null);

        return $this->success($state, __('messages.chat.message_read'));
    }

    public function pin(Request $request, int $conversation, int $message): JsonResponse
    {
        $pinned = $this->pinMessage->handle($request->user(), $conversation, $message);

        return $this->success(new MessageResource($pinned), __('messages.chat.message_pinned'));
    }

    public function unpin(Request $request, int $conversation, int $message): JsonResponse
    {
        $unpinned = $this->pinMessage->unpin($request->user(), $conversation, $message);

        return $this->success(new MessageResource($unpinned), __('messages.chat.message_unpinned'));
    }

    public function pinned(Request $request, int $conversation, ChatAccess $access, MessageHydrator $hydrator): JsonResponse
    {
        $membership = $access->membership($request->user(), $conversation);

        $messages = $this->listMessages->visible($membership)
            ->where('is_pinned', true)
            ->orderByDesc('pinned_at')
            ->orderByDesc('id')
            ->get();

        $hydrator->hydrate($messages);

        return $this->success(data: MessageResource::collection($messages));
    }

    public function search(SearchMessagesRequest $request): JsonResponse
    {
        $results = $this->searchMessages->handle($request->user(), $request->validated());

        $items = collect($results->items())->map(fn (Message $message): array => [
            ...(new MessageResource($message))->resolve($request),
            'conversation' => $message->conversation ? [
                'id' => $message->conversation->id,
                'type' => $message->conversation->type,
                'title' => $message->conversation->viewerContext['search_title'] ?? $message->conversation->title,
            ] : null,
        ]);

        return $this->responsePagination($results, $items);
    }
}
