<?php

namespace App\Domain\Setting\Services;

use App\Domain\Identity\Models\User;
use Carbon\Carbon;

class UserDateFormatter
{
    public const TIME_FORMAT_12H = '12h';

    public const TIME_FORMAT_24H = '24h';

    public const DEFAULT_DATE_FORMAT = 'Y-m-d';

    public const DEFAULT_TIME_FORMAT = self::TIME_FORMAT_24H;

    /**
     * Date formats users are allowed to pick in Settings.
     *
     * @return array<string, string>
     */
    public static function availableDateFormats(): array
    {
        return [
            'Y-m-d' => '2026-09-14',
            'd.m.Y' => '14.09.2026',
            'd/m/Y' => '14/09/2026',
            'm/d/Y' => '09/14/2026',
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function availableTimeFormats(): array
    {
        return [
            self::TIME_FORMAT_24H => '15:45',
            self::TIME_FORMAT_12H => '3:45 PM',
        ];
    }

    public function format(?Carbon $date, ?User $user): ?string
    {
        if (! $date) {
            return null;
        }

        $settings = $user?->settings;

        return $date->clone()
            ->setTimezone($this->resolveTimezone($user))
            ->format($this->resolveDateFormat($settings?->date_format).' '.$this->resolveTimeFormat($settings?->time_format));
    }

    public function formatDate(?Carbon $date, ?User $user): ?string
    {
        if (! $date) {
            return null;
        }

        return $date->clone()
            ->setTimezone($this->resolveTimezone($user))
            ->format($this->resolveDateFormat($user?->settings?->date_format));
    }

    public function formatTime(?Carbon $date, ?User $user): ?string
    {
        if (! $date) {
            return null;
        }

        return $date->clone()
            ->setTimezone($this->resolveTimezone($user))
            ->format($this->resolveTimeFormat($user?->settings?->time_format));
    }

    public function iso(?Carbon $date, ?User $user): ?string
    {
        if (! $date) {
            return null;
        }

        return $date->clone()
            ->setTimezone($this->resolveTimezone($user))
            ->toIso8601String();
    }

    public function resolveTimezone(?User $user): string
    {
        $timezone = trim((string) ($user?->settings?->timezone?->name ?? config('app.timezone')));

        return $timezone !== '' ? $timezone : config('app.timezone');
    }

    private function resolveDateFormat(?string $format): string
    {
        if ($format && array_key_exists($format, self::availableDateFormats())) {
            return $format;
        }

        return self::DEFAULT_DATE_FORMAT;
    }

    private function resolveTimeFormat(?string $code): string
    {
        return match ($code) {
            self::TIME_FORMAT_12H => 'h:i A',
            self::TIME_FORMAT_24H, null, '' => 'H:i',
            default => 'H:i',
        };
    }
}
