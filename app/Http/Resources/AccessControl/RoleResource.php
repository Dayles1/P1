<?php

namespace App\Http\Resources\AccessControl;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Roles are seeded with a per-locale 'name' translation (see
            // RoleSeeder); fall back to the raw column for any role that
            // was created without one.
            'name' => $this->getTranslation('name') ?? $this->name,
            'code' => $this->code,
            // Optional, per-locale — most roles won't have one seeded yet;
            // the frontend treats a null description as "no description".
            'description' => $this->getTranslation('description'),
        ];
    }
}
