<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\Message;

/**
 * A poll message's results, from `meta.poll` and its loaded `pollVotes`.
 */
class PollPresenter
{
    /**
     * @return array{question: string, options: array<int, array{id: int, text: string, votes: int}>, total_voters: int, multiple: bool, anonymous: bool, closed: bool, closed_at_iso: string|null, my_votes?: array<int, int>}|null
     */
    public function present(Message $message, ?int $viewerId, bool $withMyVotes = true): ?array
    {
        $poll = $message->meta['poll'] ?? null;

        if (! $message->isPoll() || ! is_array($poll)) {
            return null;
        }

        $votes = $message->pollVotes;
        $countsByOption = $votes->countBy('option_id');

        $data = [
            'question' => (string) ($poll['question'] ?? ''),
            'options' => collect(array_values((array) ($poll['options'] ?? [])))
                ->map(fn ($text, int $index): array => [
                    'id' => $index,
                    'text' => (string) $text,
                    'votes' => (int) ($countsByOption[$index] ?? 0),
                ])
                ->all(),
            'total_voters' => $votes->pluck('user_id')->unique()->count(),
            'multiple' => (bool) ($poll['multiple'] ?? false),
            'anonymous' => (bool) ($poll['anonymous'] ?? false),
            'closed' => ! empty($poll['closed_at']),
            'closed_at_iso' => $poll['closed_at'] ?? null,
        ];

        if ($withMyVotes) {
            $data['my_votes'] = $viewerId === null ? [] : $votes
                ->where('user_id', $viewerId)
                ->pluck('option_id')
                ->map(fn ($id): int => (int) $id)
                ->sort()
                ->values()
                ->all();
        }

        return $data;
    }
}
