<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\AddConversationMembers;
use App\Domain\Chat\Actions\ChangeMemberRole;
use App\Domain\Chat\Actions\RemoveConversationMembers;
use App\Domain\Chat\Actions\ShowConversation;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Queries\GetConversationMembersQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ConversationMembersRequest;
use App\Http\Requests\Chat\TransferOwnershipRequest;
use App\Http\Requests\Chat\UpdateMemberRoleRequest;
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
        protected ChangeMemberRole $changeMemberRole,
        protected ShowConversation $showConversation,
    ) {}

    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        $perPage = (int) ($request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ])['per_page'] ?? 50);

        $members = $this->getConversationMembers->execute($conversation, $request->user(), $perPage);

        return $this->responsePagination(
            $members,
            ConversationMemberResource::collection($members),
            __('messages.chat.members_listed')
        );
    }

    public function store(ConversationMembersRequest $request, Conversation $conversation): JsonResponse
    {
        $result = $this->addConversationMembers->handle(
            actor: $request->user(),
            conversation: $conversation,
            userIds: $request->validated('user_ids')
        );

        return $this->success(
            data: [
                'members' => $result,
                'conversation' => new ConversationShowResource($this->showConversation->handle($request->user(), $conversation->id)),
            ],
            message: __('messages.chat.members_added')
        );
    }

    public function destroy(ConversationMembersRequest $request, Conversation $conversation): JsonResponse
    {
        $result = $this->removeConversationMembers->handle(
            actor: $request->user(),
            conversation: $conversation,
            userIds: $request->validated('user_ids')
        );

        $stillMember = ! in_array((int) $request->user()->id, $result['removed'], true);

        return $this->success(
            data: [
                'members' => $result,
                'conversation' => $stillMember
                    ? new ConversationShowResource($this->showConversation->handle($request->user(), $conversation->id))
                    : null,
            ],
            message: __('messages.chat.members_removed')
        );
    }

    public function updateRole(UpdateMemberRoleRequest $request, Conversation $conversation, int $user): JsonResponse
    {
        $this->changeMemberRole->changeRole($request->user(), $conversation->id, $user, $request->validated('role'));

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation->id)),
            __('messages.chat.updated')
        );
    }

    public function transfer(TransferOwnershipRequest $request, Conversation $conversation): JsonResponse
    {
        $this->changeMemberRole->transferOwnership($request->user(), $conversation->id, (int) $request->validated('user_id'));

        return $this->success(
            new ConversationShowResource($this->showConversation->handle($request->user(), $conversation->id)),
            __('messages.chat.updated')
        );
    }
}
