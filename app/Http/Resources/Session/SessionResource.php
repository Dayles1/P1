<?php

namespace App\Http\Resources\Session;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        $user = $request->user();

        return [
            'id' => $this->id,
            'personal_access_token_id' => $this->personal_access_token_id,

            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'device_name' => $this->device_name,
            'device_type' => $this->device_type,
            'browser' => $this->browser,
            'platform' => $this->platform,

            'logged_in_at' => $formatter->format(
                $this->logged_in_at,
                $user
            ),

            'last_activity_at' => $formatter->format(
                $this->last_activity_at,
                $user
            ),

            'logged_out_at' => $formatter->format(
                $this->logged_out_at,
                $user
            ),

            'status' => $this->logged_out_at
                ? 'expired'
                : 'active',

            'is_current' => (int) $this->personal_access_token_id ===
                (int) optional($request->user()?->currentAccessToken())->id,
        ];
    }
}