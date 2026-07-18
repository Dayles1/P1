<?php

namespace App\Http\Resources\Profile;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        return [
            'id' => $this->id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'device_name' => $this->device_name,
            'browser' => $this->browser,
            'platform' => $this->platform,
            'last_used_at' => $formatter->format($this->last_used_at, $request->user()),
            'created_at' => $formatter->format($this->created_at, $request->user()),
        ];
    }
}