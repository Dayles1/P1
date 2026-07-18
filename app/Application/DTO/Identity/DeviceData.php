<?php

namespace App\Application\DTO\Identity;

use Illuminate\Http\Request;

final class DeviceData
{
    public function __construct(
        public readonly ?string $ip_address,
        public readonly ?string $user_agent,
        public readonly ?string $device_type,
        public readonly ?string $browser,
        public readonly ?string $platform,
        public readonly ?string $device_name,
    ) {}

    public static function fromRequest(Request $request, array $parsedDevice): self
    {
        return new self(
            ip_address: $request->ip(),
            user_agent: $request->userAgent(),
            device_type: $parsedDevice['device_type'] ?? null,
            browser: $parsedDevice['browser'] ?? null,
            platform: $parsedDevice['platform'] ?? null,
            device_name: $parsedDevice['device_name'] ?? null,
        );
    }
}