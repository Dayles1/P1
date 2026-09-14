<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Identity\Actions\User\SearchUsers;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSearchController extends Controller
{
    public function __construct(
        protected SearchUsers $searchUsers,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ])['q'];

        $users = $this->searchUsers->handle($request->user(), $query);

        return $this->success(
            data: $users->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])->values()
        );
    }
}
