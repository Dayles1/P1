<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Identity\Actions\Session\GetUserSessions;
use App\Domain\Identity\Actions\Session\RevokeOtherSessions;
use App\Domain\Identity\Actions\Session\RevokeSession;
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
    ) {
    }
    public function index(Request $request): JsonResponse
    {
        
        $validated = $request->validate([
            'status' => ['nullable', 'in:all,active,expired'],
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
