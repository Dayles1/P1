<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Models\Message;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * The preview card (title, description, picture) for the first link in a
 * message. Fetched after the response has been sent (`defer()`), so a slow
 * site never slows a send; the card then arrives as `message.edited`.
 *
 * Only public addresses are fetched: http(s) on ports 80/443, every
 * resolved address must be public (no loopback, private or reserved
 * ranges), the connection is pinned to the checked address (no DNS
 * rebinding), redirects are re-checked hop by hop, 3 seconds at most and
 * only the first 512 KB of HTML are read.
 */
class LinkPreviews
{
    private const URL_PATTERN = '~\bhttps?://[^\s<>"\'()\[\]]+~iu';

    private const MAX_REDIRECTS = 3;

    public function __construct(
        private readonly HostResolver $resolver,
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
    ) {}

    public function schedule(Message $message): void
    {
        if (! config('chat.link_previews.enabled', true) || $message->type !== Message::TYPE_TEXT) {
            return;
        }

        $url = $this->firstUrl((string) $message->body);

        if ($url === null) {
            return;
        }

        $messageId = (int) $message->id;

        defer(fn () => $this->attach($messageId, $url));
    }

    public function attach(int $messageId, string $url): void
    {
        $preview = $this->fetch($url);

        if ($preview === null) {
            return;
        }

        $message = Message::query()->find($messageId);

        // Edited (or deleted) in the meantime: this card is for another text.
        if (! $message || $this->firstUrl((string) $message->body) !== $url) {
            return;
        }

        $meta = $message->meta ?? [];
        $meta['link_preview'] = $preview;
        $message->forceFill(['meta' => $meta])->saveQuietly();

        $this->hydrator->hydrate($message);

        LiveUpdates::toEveryone(new MessageEdited($this->access->memberIds((int) $message->conversation_id), $message));
    }

    public function firstUrl(string $body): ?string
    {
        if (! preg_match(self::URL_PATTERN, $body, $match)) {
            return null;
        }

        return rtrim($match[0], '.,;:!?');
    }

    /**
     * @return array{url: string, site_name: string|null, title: string|null, description: string|null, image_url: string|null}|null
     */
    public function fetch(string $url, int $redirectsLeft = self::MAX_REDIRECTS): ?array
    {
        try {
            $target = $this->safeTarget($url);

            if ($target === null) {
                return null;
            }

            [$host, $port, $ip] = $target;

            $response = Http::timeout((int) config('chat.link_previews.timeout', 3))
                ->connectTimeout((int) config('chat.link_previews.timeout', 3))
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (compatible; ChatLinkPreview/1.0)',
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->withOptions([
                    'allow_redirects' => false,
                    'stream' => true,
                    'curl' => [CURLOPT_RESOLVE => ["{$host}:{$port}:{$ip}"]],
                ])
                ->get($url);

            if ($response->redirect()) {
                $location = (string) $response->header('Location');

                return $redirectsLeft > 0 && $location !== ''
                    ? $this->fetch($this->absoluteUrl($location, $url) ?? '', $redirectsLeft - 1)
                    : null;
            }

            if (! $response->successful() || ! str_contains(strtolower($response->header('Content-Type')), 'html')) {
                return null;
            }

            return $this->parse($this->readLimited($response->toPsrResponse()->getBody()), $url);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Host, port and the public address to connect to — or null when the
     * URL points anywhere but the public internet.
     *
     * @return array{0: string, 1: int, 2: string}|null
     */
    private function safeTarget(string $url): ?array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));

        if (! in_array($port, [80, 443], true)) {
            return null;
        }

        $addresses = $this->resolver->resolve($host);

        if ($addresses === []) {
            return null;
        }

        foreach ($addresses as $address) {
            if (! filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return null;
            }
        }

        return [trim($host, '[]'), $port, $addresses[0]];
    }

    private function readLimited(mixed $stream): string
    {
        $limit = (int) config('chat.link_previews.max_bytes', 512 * 1024);
        $html = '';

        while (! $stream->eof() && strlen($html) < $limit) {
            $html .= $stream->read(min(65536, $limit - strlen($html)));
        }

        return $html;
    }

    /**
     * @return array{url: string, site_name: string|null, title: string|null, description: string|null, image_url: string|null}|null
     */
    private function parse(string $html, string $url): ?array
    {
        $meta = [];

        if (preg_match_all('~<meta\s[^>]*>~i', $html, $tags)) {
            foreach ($tags[0] as $tag) {
                if (preg_match('~(?:property|name)\s*=\s*["\']([^"\']+)["\']~i', $tag, $key)
                    && preg_match('~content\s*=\s*(["\'])(.*?)\1~is', $tag, $content)) {
                    $meta[strtolower($key[1])] ??= $this->clean($content[2]);
                }
            }
        }

        $title = $meta['og:title'] ?? $meta['twitter:title'] ?? null;

        if ($title === null && preg_match('~<title[^>]*>(.*?)</title>~is', $html, $match)) {
            $title = $this->clean($match[1]);
        }

        $description = $meta['og:description'] ?? $meta['twitter:description'] ?? $meta['description'] ?? null;
        $image = $meta['og:image'] ?? $meta['twitter:image'] ?? null;

        if (($title === null || $title === '') && ($description === null || $description === '')) {
            return null;
        }

        return [
            'url' => $url,
            'site_name' => $meta['og:site_name'] ?? (parse_url($url, PHP_URL_HOST) ?: null),
            'title' => $title !== null ? Str::limit($title, 200) : null,
            'description' => $description !== null ? Str::limit($description, 300) : null,
            'image_url' => $image !== null ? $this->absoluteUrl($image, $url) : null,
        ];
    }

    private function clean(string $value): string
    {
        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
    }

    /**
     * `$reference` resolved against `$base`; only http(s) results.
     */
    private function absoluteUrl(string $reference, string $base): ?string
    {
        $reference = trim($reference);

        if (preg_match('~^https?://~i', $reference)) {
            return $reference;
        }

        $parts = parse_url($base);

        if (! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');

        if (str_starts_with($reference, '//')) {
            return $parts['scheme'].':'.$reference;
        }

        if (str_starts_with($reference, '/')) {
            return $origin.$reference;
        }

        $path = isset($parts['path']) ? preg_replace('~/[^/]*$~', '/', $parts['path']) : '/';

        return $origin.$path.$reference;
    }
}
