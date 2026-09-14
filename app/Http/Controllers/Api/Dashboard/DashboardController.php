<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Domain\Dashboard\Actions\GetDashboardSummary;
use App\Http\Controllers\Controller;
use App\Http\Resources\Dashboard\DashboardSummaryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        protected GetDashboardSummary $getDashboardSummary,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success(
            new DashboardSummaryResource($this->getDashboardSummary->handle($request->user()))
        );
    }
}
