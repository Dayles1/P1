<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Identity\Actions\Session\GetUserSessions;
use App\Domain\Identity\Actions\Session\RevokeOtherSessions;
use App\Domain\Identity\Actions\Session\RevokeSession;
use App\Domain\Identity\Models\UserSession;
use App\Http\Controllers\Controller;
use App\Http\Resources\Session\SessionResource;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\JsonResponse;

class SessionController extends Controller
{
    public function __construct(
        protected GetUserSessions $getUserSessions,
        protected RevokeSession $revokeSession,
        protected RevokeOtherSessions $revokeOtherSessions,
    ) {}

    public function index(Request $request): JsonResponse
    {

        $validated = $request->validate([
            'status' => ['nullable', 'in:all,active,expired'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sessions = $this->getUserSessions->handle(
            $request->user(),
            $validated
        );

        return $this->responsePagination(
            $sessions,
            SessionResource::collection($sessions)
        );
    }

    public function show(Request $request, UserSession $session): JsonResponse
    {
        $this->authorize('manage', $session);

        return $this->success(
            new SessionResource($session->load('token'))
        );
    }

    public function destroy(Request $request, string $sessionId): JsonResponse
    {
        $this->revokeSession->handle($request->user(), $sessionId);

        return $this->success(
            message: __('messages.session.revoked')
        );
    }

    public function destroyOthers(Request $request): JsonResponse
    {
        $revoked = $this->revokeOtherSessions->handle($request->user());

        return $this->success(
            message: $revoked > 0
            ? __('messages.session.others_revoked')
            : __('messages.session.no_other_sessions'),
            data: [
                'revoked_sessions' => $revoked,
            ]
        );
    }
}
