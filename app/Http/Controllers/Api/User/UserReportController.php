<?php

namespace App\Http\Controllers\Api\User;

use App\Domain\Identity\Actions\User\ReportUser;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\ReportUserRequest;
use Illuminate\Http\JsonResponse;

class UserReportController extends Controller
{
    public function __construct(
        protected ReportUser $reportUser,
    ) {}

    public function store(ReportUserRequest $request, User $user): JsonResponse
    {
        if ((int) $request->user()->id === (int) $user->id) {
            return $this->error(__('messages.profile.cannot_report_self'), 422);
        }

        $this->reportUser->handle(
            $request->user(),
            $user,
            $request->validated('reason'),
            $request->validated('comment'),
        );

        return $this->success(message: __('messages.profile.reported'));
    }
}
