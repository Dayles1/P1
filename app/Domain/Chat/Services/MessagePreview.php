<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\Message;
use Illuminate\Support\Str;

/**
 * A message as one line of plain text — for the chat list, a reply quote
 * or a pinned-message line: mention tokens become `@Name`, a photo becomes
 * "Фото", a poll "📊 question", a service message its sentence.
 */
class MessagePreview
{
    public const MENTION_PATTERN = '/@\[([^\]]+)\]\((\d+)\)/u';

    public function for(Message $message, int $limit = 120): string
    {
        if ($message->isSystem()) {
            return Str::limit($this->systemSentence($message), $limit);
        }

        if ($message->isPoll()) {
            return Str::limit('📊 '.($message->meta['poll']['question'] ?? ''), $limit);
        }

        $text = $this->plainText((string) $message->body);

        if ($text !== '') {
            return Str::limit($text, $limit);
        }

        $attachment = $message->attachments->first();

        if (! $attachment) {
            return '';
        }

        return Str::limit(match ($attachment->kind()) {
            'image' => __('messages.chat.preview.photo'),
            'video' => __('messages.chat.preview.video'),
            'voice' => __('messages.chat.preview.voice'),
            'audio' => __('messages.chat.preview.audio'),
            default => (string) $attachment->original_name,
        }, $limit);
    }

    /**
     * The raw body without mention tokens or markdown markers, on one line.
     */
    public function plainText(string $body): string
    {
        $text = preg_replace(self::MENTION_PATTERN, '@$1', $body) ?? $body;
        $text = preg_replace('/\[([^\]]+)\]\((https?:[^)]+)\)/u', '$1', $text) ?? $text;
        $text = preg_replace('/(\*\*|__|~~|`{1,3})/u', '', $text) ?? $text;

        return trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? $text);
    }

    /**
     * "Alisher added Maria", in the current locale.
     */
    public function systemSentence(Message $message): string
    {
        $system = $message->meta['system'] ?? [];
        $event = (string) ($system['event'] ?? '');
        $params = (array) ($system['params'] ?? []);
        $key = "messages.chat.system.{$event}";

        $replace = [
            'actor' => (string) ($system['actor_name'] ?? ''),
            'title' => (string) ($params['title'] ?? ''),
            'name' => (string) ($params['name'] ?? ''),
            'names' => implode(', ', array_map('strval', (array) ($params['names'] ?? []))),
            'description' => (string) ($params['description'] ?? ''),
            'preview' => (string) ($params['preview'] ?? ''),
        ];

        $sentence = __($key, $replace);

        return $sentence === $key ? $event : $sentence;
    }
}
