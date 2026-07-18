<?php

namespace App\Infrastructure\Device;

class UserAgentParser
{
    public function parse(?string $userAgent): array
    {
        $ua = strtolower($userAgent ?? '');

        return [
            'device_type' => $this->deviceType($ua),
            'browser' => $this->browser($ua),
            'platform' => $this->platform($ua),
            'device_name' => $this->deviceName($ua),
        ];
    }

    private function deviceType(string $ua): string
    {
        if (str_contains($ua, 'tablet') || str_contains($ua, 'ipad')) {
            return 'tablet';
        }

        if (
            str_contains($ua, 'mobile') ||
            str_contains($ua, 'android') ||
            str_contains($ua, 'iphone')
        ) {
            return 'mobile';
        }

        return 'desktop';
    }

    private function browser(string $ua): string
    {
        return match (true) {
            str_contains($ua, 'edg') => 'Edge',
            str_contains($ua, 'opr') || str_contains($ua, 'opera') => 'Opera',
            str_contains($ua, 'firefox') => 'Firefox',
            str_contains($ua, 'chrome') && ! str_contains($ua, 'edg') && ! str_contains($ua, 'opr') => 'Chrome',
            str_contains($ua, 'safari') && ! str_contains($ua, 'chrome') => 'Safari',
            default => 'Unknown',
        };
    }

    private function platform(string $ua): string
    {
        return match (true) {
            str_contains($ua, 'windows') => 'Windows',
            str_contains($ua, 'android') => 'Android',
            str_contains($ua, 'iphone') || str_contains($ua, 'ios') => 'iOS',
            str_contains($ua, 'ipad') => 'iPadOS',
            str_contains($ua, 'mac os') || str_contains($ua, 'macintosh') => 'macOS',
            str_contains($ua, 'linux') => 'Linux',
            default => 'Unknown',
        };
    }

    private function deviceName(string $ua): string
    {
        $browser = $this->browser($ua);
        $platform = $this->platform($ua);

        if ($browser === 'Unknown' && $platform === 'Unknown') {
            return 'Unknown device';
        }

        if ($browser === 'Unknown') {
            return $platform;
        }

        if ($platform === 'Unknown') {
            return $browser;
        }

        return "{$browser} on {$platform}";
    }
}