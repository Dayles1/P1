<?php

namespace App\Http\Resources\Profile;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'timezone' => $this->whenLoaded('timezone') ? [
                'id' => $this->timezone->id,
                'name' => $this->timezone->name,
                'label' => $this->timezone->label,
                'offset' => $this->timezone->offset,
            ] : null,
            'timezone_source' => $this->timezone_source,
            'locale' => $this->locale,
            'theme' => $this->theme,
            'date_format' => $this->date_format,
            'time_format' => $this->time_format,
            'meta' => $this->meta,
        ];
    }
}