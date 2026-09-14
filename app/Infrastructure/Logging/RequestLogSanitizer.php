<?php

namespace App\Infrastructure\Logging;

class RequestLogSanitizer
{
    private const REDACTED = '[REDACTED]';

    /**
     * Recursively redact sensitive keys from a request/response body or
     * query-parameter array. Case-insensitive on the key name.
     *
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    public function sanitizeFields(array $data): array
    {
        $redactedKeys = array_map('strtolower', config('request-logging.redacted_keys', []));

        return $this->walk($data, $redactedKeys);
    }

    /**
     * @param  array<string, mixed>  $headers
     * @return array<string, mixed>
     */
    public function sanitizeHeaders(array $headers): array
    {
        $redactedHeaders = array_map('strtolower', config('request-logging.redacted_headers', []));

        $result = [];

        foreach ($headers as $name => $value) {
            $result[$name] = in_array(strtolower((string) $name), $redactedHeaders, true)
                ? self::REDACTED
                : $value;
        }

        return $result;
    }

    /**
     * JSON-encode a value and hard-truncate it to the configured byte
     * budget, so a single huge payload can never bloat the log table.
     *
     * @return array{0: mixed, 1: bool} [possibly-truncated value, was truncated]
     */
    public function capture(mixed $value): array
    {
        if ($value === null || $value === []) {
            return [$value, false];
        }

        $maxBytes = (int) config('request-logging.max_body_bytes', 8192);
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);

        if ($encoded === false || strlen($encoded) <= $maxBytes) {
            return [$value, false];
        }

        $truncated = substr($encoded, 0, $maxBytes);

        return [
            [
                '_truncated' => true,
                '_preview' => $truncated,
            ],
            true,
        ];
    }

    /**
     * @param  array<array-key, mixed>  $data
     * @param  list<string>  $redactedKeys
     * @return array<array-key, mixed>
     */
    private function walk(array $data, array $redactedKeys): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), $redactedKeys, true)) {
                $result[$key] = self::REDACTED;

                continue;
            }

            $result[$key] = is_array($value) ? $this->walk($value, $redactedKeys) : $value;
        }

        return $result;
    }
}
