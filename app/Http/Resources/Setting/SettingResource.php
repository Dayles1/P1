<?php

namespace App\Http\Resources\Setting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'value' => $this->typed_value,
            'type' => $this->type,
            'group' => $this->group,
            'is_public' => $this->is_public,
            'is_locked' => $this->is_locked,
        ];
    }
}
