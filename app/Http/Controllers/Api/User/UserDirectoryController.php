<?php

namespace App\Http\Controllers\Api\User;

use App\Domain\Identity\Actions\User\ListDirectoryUsers;
use App\Domain\Identity\Actions\User\ShowUserProfile;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Resources\User\DirectoryUserResource;
use App\Http\Resources\User\UserProfileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserDirectoryController extends Controller
{
    public function __construct(
        protected ListDirectoryUsers $listDirectoryUsers,
        protected ShowUserProfile $showUserProfile,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $users = $this->listDirectoryUsers->handle($request->user(), $filters);

        return $this->responsePagination(
            $users,
            DirectoryUserResource::collection($users)
        );
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $profile = $this->showUserProfile->handle($request->user(), $user);

        return $this->success(new UserProfileResource($profile['user'], $profile));
    }
}
