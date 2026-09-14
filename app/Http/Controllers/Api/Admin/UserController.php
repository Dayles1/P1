<?php

namespace App\Http\Controllers\Api\Admin;

use App\Domain\Identity\Actions\User\BanUser;
use App\Domain\Identity\Actions\User\ChangeUserRole;
use App\Domain\Identity\Actions\User\ListUsers;
use App\Domain\Identity\Actions\User\UnbanUser;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BanUserRequest;
use App\Http\Requests\Admin\UpdateUserRoleRequest;
use App\Http\Resources\Admin\AdminUserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        protected ListUsers $listUsers,
        protected ChangeUserRole $changeUserRole,
        protected BanUser $banUser,
        protected UnbanUser $unbanUser,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = $this->listUsers->handle($filters);

        return $this->responsePagination(
            $users,
            AdminUserResource::collection($users)
        );
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['roles', 'permissions', 'ban', 'avatar', 'department']);

        return $this->success(new AdminUserResource($user));
    }

    public function updateRole(UpdateUserRoleRequest $request, User $user): JsonResponse
    {
        $updated = $this->changeUserRole->handle(
            $request->user(),
            $user,
            $request->validated('role')
        );

        return $this->success(
            new AdminUserResource($updated->load(['roles', 'ban', 'avatar'])),
            __('messages.admin.role_updated')
        );
    }

    public function ban(BanUserRequest $request, User $user): JsonResponse
    {
        $this->banUser->handle($request->user(), $user, $request->validated());

        return $this->success(
            new AdminUserResource($user->fresh(['roles', 'ban', 'avatar'])),
            __('messages.admin.user_banned')
        );
    }

    public function unban(Request $request, User $user): JsonResponse
    {
        $this->unbanUser->handle($request->user(), $user);

        return $this->success(
            new AdminUserResource($user->fresh(['roles', 'ban', 'avatar'])),
            __('messages.admin.user_unbanned')
        );
    }
}
