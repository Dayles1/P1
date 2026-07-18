<?php

namespace App\Domain\Audit\Services;

use App\Domain\Audit\Models\Audit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogger
{
    public function record(
        Model $subject,
        string $event,
        array $oldValues = [],
        array $newValues = [],
        ?string $title = null,
        ?string $description = null,
        array $meta = [],
        ?Model $causer = null
    ): Audit {
        $request = request();

        return Audit::create([
            'causer_type' => $causer ? $causer::class : Auth::user()?->getMorphClass(),
            'causer_id' => $causer?->getKey() ?? Auth::id(),

            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),

            'event' => $event,
            'title' => $title,
            'description' => $description,

            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'meta' => $meta ?: null,

            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'url' => $request?->fullUrl(),
            'method' => $request?->method(),
            'route_name' => $request?->route()?->getName(),
        ]);
    }
}