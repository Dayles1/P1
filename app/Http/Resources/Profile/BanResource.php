<?php

namespace App\Http\Resources\Profile;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        return [
            'id' => $this->id,
            'reason' => $this->reason,

            'starts_at' => $formatter->format(
                $this->starts_at,
                $this->user
            ),

            'ends_at' => $formatter->format(
                $this->ends_at,
                $this->user
            ),

            'is_active' => $this->isActive(),
        ];
    }
}