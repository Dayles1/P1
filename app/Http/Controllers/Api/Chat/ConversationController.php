<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\ChatStore;
use App\Domain\Chat\Actions\ClearConversationHistory;
use App\Domain\Chat\Actions\DeleteConversation;
use App\Domain\Chat\Actions\FindOrCreateSavedConversation;
use App\Domain\Chat\Actions\GetUnreadSummary;
use App\Domain\Chat\Actions\LeaveConversation;
use App\Domain\Chat\Actions\ShowConversation;
use App\Domain\Chat\Actions\UpdateConversation;
use App\Domain\Chat\Actions\UpdateConversationAvatar;
use App\Domain\Chat\Actions\UpdateConversationSettings;
use App\Domain\Chat\Queries\GetConversationsQuery;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ChatStoreRequest;
use App\Http\Requests\Chat\ConversationAvatarRequest;
use App\Http\Requests\Chat\GetConversationsRequest;
use App\Http\Requests\Chat\UpdateConversationRequest;
use App\Http\Requests\Chat\UpdateConversationSettingsRequest;
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
        protected UpdateConversationSettings $updateSettings,
        protected ConversationPresenter $presenter,
    ) {}

    public function store(ChatStoreRequest $request): JsonResponse
    {
        $conversation = $this->chatStore->handle($request->user(), $request->validated());

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation->id)),
        );
    }

    public function index(GetConversationsRequest $request, GetConversationsQuery $query): JsonResponse
    {
        $conversations = $query->execute($request->user(), $request->validated());

        return $this->responsePagination(
            $conversations,
            ConversationListResource::collection($conversations),
            __('messages.chat.list')
        );
    }

    public function show(Request $request, int $conversation): JsonResponse
    {
        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation))
        );
    }

    /**
     * One chat-list row — to refresh a single chat without the whole list.
     */
    public function summary(Request $request, int $conversation): JsonResponse
    {
        return $this->success(
            new ConversationListResource($this->presenter->findForViewer($request->user(), $conversation))
        );
    }

    public function unread(Request $request, GetUnreadSummary $unreadSummary): JsonResponse
    {
        return $this->success($unreadSummary->handle($request->user()));
    }

    public function saved(Request $request, FindOrCreateSavedConversation $savedConversation): JsonResponse
    {
        $conversation = $savedConversation->handle($request->user());

        return $this->success(
            new ConversationListResource($this->presenter->findForViewer($request->user(), $conversation->id))
        );
    }

    public function update(UpdateConversationRequest $request, int $conversation): JsonResponse
    {
        $this->updateConversation->handle($request->user(), $conversation, $request->validated());

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation)),
            __('messages.chat.updated')
        );
    }

    public function storeAvatar(ConversationAvatarRequest $request, int $conversation, UpdateConversationAvatar $avatar): JsonResponse
    {
        $avatar->store($request->user(), $conversation, $request->file('file'));

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation)),
            __('messages.chat.updated')
        );
    }

    public function destroyAvatar(Request $request, int $conversation, UpdateConversationAvatar $avatar): JsonResponse
    {
        $avatar->destroy($request->user(), $conversation);

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation)),
            __('messages.chat.updated')
        );
    }

    public function settings(UpdateConversationSettingsRequest $request, int $conversation): JsonResponse
    {
        $this->updateSettings->handle($request->user(), $conversation, $request->validated());

        return $this->success(
            new ConversationListResource($this->presenter->findForViewer($request->user(), $conversation))
        );
    }

    public function clear(Request $request, int $conversation, ClearConversationHistory $clearHistory): JsonResponse
    {
        $clearHistory->handle($request->user(), $conversation);

        return $this->success(
            new ConversationListResource($this->presenter->findForViewer($request->user(), $conversation)),
            __('messages.chat.cleared')
        );
    }

    public function leave(Request $request, int $conversation, LeaveConversation $leaveConversation): JsonResponse
    {
        $leaveConversation->handle($request->user(), $conversation);

        return $this->success(message: __('messages.chat.left'));
    }

    public function destroy(Request $request, int $conversation): JsonResponse
    {
        $this->deleteConversation->handle($request->user(), $conversation);

        return $this->success(message: __('messages.chat.deleted'));
    }

    /**
     * Older endpoint: the same as `PATCH …/settings {pinned: true}`.
     */
    public function pin(Request $request, int $conversation): JsonResponse
    {
        $this->updateSettings->handle($request->user(), $conversation, ['pinned' => true]);

        return $this->success(message: __('messages.chat.pinned'));
    }

    public function unpin(Request $request, int $conversation): JsonResponse
    {
        $this->updateSettings->handle($request->user(), $conversation, ['pinned' => false]);

        return $this->success(message: __('messages.chat.unpinned'));
    }
}
