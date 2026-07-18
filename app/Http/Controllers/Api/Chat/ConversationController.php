<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\ChatStore;
use App\Domain\Chat\Actions\DeleteConversation;
use App\Domain\Chat\Actions\PinConversation;
use App\Domain\Chat\Actions\ShowConversation;
use App\Domain\Chat\Actions\UnpinConversation;
use App\Domain\Chat\Actions\UpdateConversation;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Queries\GetConversationsQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ChatStoreRequest;
use App\Http\Requests\Chat\UpdateConversationRequest;
use App\Http\Resources\Chat\ConversationListResource;
use App\Http\Resources\Chat\ConversationShowResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function __construct(
        protected ChatStore $chatStore,
        protected ShowConversation $showConversation,
        protected UpdateConversation $updateConversation,
        protected DeleteConversation $deleteConversation,
        protected PinConversation $pinConversation,
        protected UnpinConversation $unpinConversation,
    ) {
    }

    public function store(ChatStoreRequest $request): JsonResponse
    {
        $conversation = $this->chatStore->handle($request->validated());

        return $this->success(
            new ConversationShowResource($conversation->load('creator', 'users')),
        );
    }

    public function index(Request $request, GetConversationsQuery $query): JsonResponse
    {
        $conversations = $query->execute(
            $request->user(),
            $request->all()
        );

        return $this->responsePagination(
            $conversations,
            ConversationListResource::collection($conversations),
            __('Conversations retrieved successfully')
        );
    }

    public function show(Request $request, int $conversationId): JsonResponse
    {
        $conversation = $this->showConversation->handle(
            $request->user(),
            $conversationId
        );

        return $this->success(
            new ConversationShowResource($conversation)
        );
    }

    public function update(
        UpdateConversationRequest $request,
        Conversation $conversation
    ): JsonResponse {
        $updated = $this->updateConversation->handle(
            user: $request->user(),
            conversation: $conversation,
            data: $request->validated()
        );

        return $this->success(
            new ConversationShowResource($updated),
            __('messages.chat.updated')
        );
    }

    public function destroy(Request $request, Conversation $conversation): JsonResponse
    {
        $this->deleteConversation->handle(
            user: $request->user(),
            conversation: $conversation
        );

        return $this->success(
            message: __('messages.chat.deleted')
        );
    }

    public function pin(Conversation $conversation): JsonResponse
    {
        $this->pinConversation->handle(
            auth()->user(),
            $conversation
        );

        return $this->success(
            message: __('messages.chat.pinned')
        );
    }

    public function unpin(Conversation $conversation): JsonResponse
    {
        $this->unpinConversation->handle(
            auth()->user(),
            $conversation
        );

        return $this->success(
            message: __('messages.chat.unpinned')
        );
    }

    
}