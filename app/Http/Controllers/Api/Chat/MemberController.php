<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\AddConversationMembers;
use App\Domain\Chat\Actions\RemoveConversationMembers;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Queries\GetConversationMembersQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ConversationMembersRequest;
use App\Http\Resources\Chat\ConversationMemberResource;
use App\Http\Resources\Chat\ConversationShowResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function __construct(
        protected GetConversationMembersQuery $getConversationMembers,
        protected AddConversationMembers $addConversationMembers,
        protected RemoveConversationMembers $removeConversationMembers,
    ) {
    }

    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        $members = $this->getConversationMembers->execute($conversation);

        return $this->responsePagination(
            $members,
            ConversationMemberResource::collection($members),
            __('Members retrieved successfully')
        );
    }

    public function store(
        ConversationMembersRequest $request,
        Conversation $conversation
    ): JsonResponse {
        try {
            $result = $this->addConversationMembers->handle(
                actor: $request->user(),
                conversation: $conversation,
                userIds: $request->validated('user_ids')
            );

            $conversation->loadCount('users');

            return $this->success(
                data: [
                    'members' => $result,
                    'conversation' => new ConversationShowResource($conversation),
                ],
                message: __('messages.chat.members_added')
            );
        } catch (\Throwable $e) {
            return $this->error(
                message: $e->getMessage(),
                status: 422
            );
        }
    }

    public function destroy(
        ConversationMembersRequest $request,
        Conversation $conversation
    ): JsonResponse {
        try {
            $result = $this->removeConversationMembers->handle(
                actor: $request->user(),
                conversation: $conversation,
                userIds: $request->validated('user_ids')
            );

            $conversation->loadCount('users');

            return $this->success(
                data: [
                    'members' => $result,
                    'conversation' => new ConversationShowResource($conversation),
                ],
                message: __('messages.chat.members_removed')
            );
        } catch (\Throwable $e) {
            return $this->error(
                message: $e->getMessage(),
                status: 422
            );
        }
    }
}