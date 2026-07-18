<?php

namespace App\Domain\Setting\Actions;

use App\Domain\Setting\Models\Setting;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Validation\ValidationException;

class UpdateSettingAction
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    public function handle(Setting $setting, array $data): Setting
    {
        if ($setting->is_locked) {
            throw ValidationException::withMessages([
                'setting' => __('messages.settings.locked'),
            ]);
        }

        $operation = $data['operation'] ?? 'set';
        $value = $this->resolveValue($setting, $data['value'] ?? null, $operation);

        $setting->update([
            'value' => Setting::normalizeValue($value, $setting->type),
        ]);

        $this->settings->forget();

        return $setting->fresh();
    }

    private function resolveValue(Setting $setting, mixed $inputValue, string $operation): mixed
    {
        return match ($setting->type) {
            Setting::TYPE_BOOLEAN => $this->resolveBoolean($setting, $inputValue, $operation),
            Setting::TYPE_INTEGER => $this->resolveInteger($setting, $inputValue, $operation),
            Setting::TYPE_JSON => $this->resolveJson($inputValue),
            Setting::TYPE_STRING,
            Setting::TYPE_TEXT => $this->resolveString($inputValue),
            default => $inputValue,
        };
    }

    private function resolveBoolean(Setting $setting, mixed $inputValue, string $operation): bool
    {
        if ($operation === 'toggle') {
            return ! (bool) $setting->typed_value;
        }

        return filter_var($inputValue, FILTER_VALIDATE_BOOLEAN);
    }

    private function resolveInteger(Setting $setting, mixed $inputValue, string $operation): int
    {
        $current = (int) $setting->typed_value;
        $step = (int) ($inputValue ?? 1);

        return match ($operation) {
            'increment' => $current + $step,
            'decrement' => $current - $step,
            default => (int) $inputValue,
        };
    }

    private function resolveJson(mixed $inputValue): array
    {
        return is_array($inputValue) ? $inputValue : [];
    }

    private function resolveString(mixed $inputValue): string
    {
        return (string) $inputValue;
    }
}