<?php

namespace App\Domain\Chat\Services;

/**
 * The IPv4 addresses a host name resolves to (a literal IP resolves to
 * itself). Its own class so tests can swap DNS out.
 */
class HostResolver
{
    /**
     * @return array<int, string>
     */
    public function resolve(string $host): array
    {
        $host = trim($host, '[]');

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $addresses = @gethostbynamel($host);

        return is_array($addresses) ? $addresses : [];
    }
}
