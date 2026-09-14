<?php

namespace App\Http\Controllers\Api\Admin;

use App\Domain\Identity\Actions\Session\GetAllSessions;
use App\Domain\Identity\Actions\Session\RevokeAnySession;
use App\Domain\Identity\Models\UserSession;
use App\Http\Controllers\Controller;
use App\Http\Resources\Session\SessionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function __construct(
        protected GetAllSessions $getAllSessions,
        protected RevokeAnySession $revokeAnySession,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'in:all,active,expired'],
            'user_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sessions = $this->getAllSessions->handle($filters);

        return $this->responsePagination(
            $sessions,
            SessionResource::collection($sessions)
        );
    }

    public function show(UserSession $session): JsonResponse
    {
        return $this->success(
            new SessionResource($session->load(['token', 'user']))
        );
    }

    public function destroy(UserSession $session): JsonResponse
    {
        $this->revokeAnySession->handle($session);

        return $this->success(
            message: __('messages.session.revoked')
        );
    }
}
