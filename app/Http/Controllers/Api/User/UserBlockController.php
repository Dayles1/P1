<?php

namespace App\Http\Controllers\Api\User;

use App\Domain\Chat\Actions\BlockUser;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Resources\User\DirectoryUserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserBlockController extends Controller
{
    public function __construct(
        protected BlockUser $blockUser,
    ) {}

    /**
     * The people the requester has blocked, most recently blocked first.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) ($request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ])['per_page'] ?? 50);

        $users = $request->user()
            ->blockedUsers()
            ->with(['avatar', 'department', 'roles'])
            ->orderByDesc('user_blocks.created_at')
            ->orderByDesc('user_blocks.id')
            ->paginate($perPage);

        return $this->responsePagination($users, DirectoryUserResource::collection($users));
    }

    public function store(Request $request, User $user): JsonResponse
    {
        $this->blockUser->block($request->user(), $user);

        return $this->success(['user_id' => $user->id, 'is_blocked' => true], __('messages.chat.user_blocked'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->blockUser->unblock($request->user(), $user);

        return $this->success(['user_id' => $user->id, 'is_blocked' => false], __('messages.chat.user_unblocked'));
    }
}
