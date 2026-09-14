<?php

namespace App\Http\Resources\Session;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RequestLogListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $user = $request->user();

        return [
            'id' => $this->id,
            'method' => $this->method,
            'path' => $this->path,
            'route_name' => $this->route_name,
            'status_code' => $this->status_code,
            'ip_address' => $this->ip_address,
            'duration_ms' => $this->duration_ms,
            'created_at' => $formatter->format($this->created_at, $user),
            'created_at_iso' => $formatter->iso($this->created_at, $user),
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null),
            'session' => $this->whenLoaded('session', fn () => $this->session ? [
                'id' => $this->session->id,
                'device_name' => $this->session->device_name,
                'ip_address' => $this->session->ip_address,
            ] : null),
        ];
    }
}
