<?php

namespace App\Domain\Setting\Services;

use App\Domain\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class UserDateFormatter
{
    public function format(?Carbon $date, ?User $user): ?string
    {
        if (!$date) {
            return null;
        }

        $timezone = trim(
            $user?->settings?->timezone?->name
            ?? config('app.timezone')
        );

        return $date->clone()
            ->setTimezone($timezone)
            ->format('Y-m-d H:i:s');
    }

    public function iso(?Carbon $date, ?User $user): ?string
    {
        if (!$date) {
            return null;
        }

        $timezone = $user?->settings?->timezone ?? config('app.timezone');

        return $date
            ->setTimezone($timezone)
            ->toIso8601String();
    }
}