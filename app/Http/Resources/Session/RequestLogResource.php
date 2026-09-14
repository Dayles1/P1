<?php

namespace App\Http\Resources\Session;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RequestLogResource extends JsonResource
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

            'query' => $this->query,
            'headers' => $this->headers,
            'body' => $this->body,
            'body_truncated' => $this->body_truncated,

            'response_headers' => $this->response_headers,
            'response_body' => $this->response_body,
            'response_truncated' => $this->response_truncated,

            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'duration_ms' => $this->duration_ms,

            'created_at' => $formatter->format($this->created_at, $user),
            'created_at_iso' => $formatter->iso($this->created_at, $user),

            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null),

            'session_id' => $this->user_session_id,
        ];
    }
}
