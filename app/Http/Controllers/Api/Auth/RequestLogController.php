<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Identity\Actions\RequestLog\GetSessionRequestLogs;
use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\UserSession;
use App\Http\Controllers\Controller;
use App\Http\Resources\Session\RequestLogListResource;
use App\Http\Resources\Session\RequestLogResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RequestLogController extends Controller
{
    public function __construct(
        protected GetSessionRequestLogs $getSessionRequestLogs,
    ) {}

    public function index(Request $request, UserSession $session): JsonResponse
    {
        $this->authorize('manage', $session);

        $filters = $request->validate([
            'method' => ['nullable', 'string', 'max:10'],
            'status' => ['nullable', 'in:2xx,3xx,4xx,5xx'],
            'status_code' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:255'],
            'sort' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = $this->getSessionRequestLogs->handle($session, $filters);

        return $this->responsePagination(
            $logs,
            RequestLogListResource::collection($logs)
        );
    }

    public function show(Request $request, UserSession $session, RequestLog $requestLog): JsonResponse
    {
        $this->authorize('manage', $session);

        abort_if((int) $requestLog->user_session_id !== (int) $session->id, 404);

        return $this->success(
            new RequestLogResource($requestLog)
        );
    }
}
