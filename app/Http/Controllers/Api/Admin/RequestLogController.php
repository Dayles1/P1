<?php

namespace App\Http\Controllers\Api\Admin;

use App\Domain\Identity\Actions\RequestLog\GetAllRequestLogs;
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
        protected GetAllRequestLogs $getAllRequestLogs,
        protected GetSessionRequestLogs $getSessionRequestLogs,
    ) {}

    private function filters(Request $request): array
    {
        return $request->validate([
            'method' => ['nullable', 'string', 'max:10'],
            'status' => ['nullable', 'in:2xx,3xx,4xx,5xx'],
            'status_code' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:255'],
            'sort' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $logs = $this->getAllRequestLogs->handle($this->filters($request));

        return $this->responsePagination(
            $logs,
            RequestLogListResource::collection($logs)
        );
    }

    public function bySession(Request $request, UserSession $session): JsonResponse
    {
        $logs = $this->getSessionRequestLogs->handle($session, $this->filters($request));

        return $this->responsePagination(
            $logs,
            RequestLogListResource::collection($logs)
        );
    }

    public function show(RequestLog $requestLog): JsonResponse
    {
        return $this->success(
            new RequestLogResource($requestLog->load(['user']))
        );
    }
}
