<?php

namespace App\Http\Resources\Dashboard;

use App\Domain\Setting\Services\UserDateFormatter;
use App\Http\Resources\Session\RequestLogListResource;
use App\Http\Resources\Session\SessionResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DashboardSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $user = $request->user();

        return [
            'account' => [
                'created_at' => $formatter->format($this['account']['created_at'], $user),
                'email_verified' => $this['account']['email_verified'],
                'has_avatar' => $this['account']['has_avatar'],
                'has_timezone_set' => $this['account']['has_timezone_set'],
                'profile_completeness' => $this['account']['profile_completeness'],
            ],
            'sessions' => $this['sessions'],
            'requests' => $this['requests'],
            'unread_messages' => $this['unread_messages'],
            'recent_sessions' => SessionResource::collection($this['recent_sessions']),
            'recent_requests' => RequestLogListResource::collection($this['recent_requests']),
            'instance' => $this->when(isset($this->resource['instance']), fn () => $this['instance']),
        ];
    }
}
