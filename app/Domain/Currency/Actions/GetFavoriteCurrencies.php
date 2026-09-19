<?php

namespace App\Domain\Currency\Actions;

use App\Domain\Currency\Models\Currency;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Collection;

/**
 * The currencies a user pinned, in the order they put them in — a
 * shortlist to read prices against, not a second preference.
 */
class GetFavoriteCurrencies
{
    public function __construct(
        private readonly SettingService $settings
    ) {}

    /**
     * @return Collection<int, Currency>
     */
    public function handle(User $user): Collection
    {
        $ids = $this->favoriteIds($user);

        if ($ids === []) {
            return collect();
        }

        $currencies = Currency::query()
            ->active()
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        /*
         * Driven by the saved id list rather than by the query, so the
         * user's own ordering survives and a currency that has since
         * been deactivated simply drops out.
         */
        return collect($ids)
            ->map(fn (int $id): ?Currency => $currencies->get($id))
            ->filter()
            ->values();
    }

    /**
     * @return list<int>
     */
    public function favoriteIds(User $user): array
    {
        $ids = array_values(array_unique(array_filter(
            $user->settings()->firstOrNew([])->favorite_currency_ids ?? [],
            static fn (mixed $id): bool => is_int($id) || ctype_digit((string) $id)
        )));

        return array_map('intval', array_slice($ids, 0, $this->maxFavorites()));
    }

    public function maxFavorites(): int
    {
        return max(1, $this->settings->integer('user.max_favorite_currency_count', 10));
    }
}
