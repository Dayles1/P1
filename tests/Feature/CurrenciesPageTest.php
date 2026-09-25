<?php

use App\Domain\Identity\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/**
 * The currencies page's own markup — everything inside `<main>`,
 * without the shell around it.
 */
function currenciesContent(TestResponse $response): string
{
    preg_match('/<main class="app-main".*?<\/main>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

/**
 * Every literal `'currencies.…'` / `'profile.…'` key the currencies
 * page script and the settings Profile section ask the dictionary for.
 *
 * @return list<string>
 */
function currencyScriptKeys(): array
{
    $source = file_get_contents(resource_path('js/blade/app/currencies.js'));

    preg_match_all("/'(currencies\.[a-z0-9_]+)'/", $source, $matches);

    return array_values(array_unique([
        ...$matches[1],
        // Built from a template literal: t(`currencies.filter_${key}`).
        'currencies.filter_all',
        'currencies.filter_popular',
        'currencies.filter_up',
        'currencies.filter_down',
        'profile.currency_hint',
        'profile.all_currencies',
        'nav.currencies',
    ]));
}

test('the currencies page renders the hooks its script fills', function () {
    $html = currenciesContent($this->get('/currencies')->assertOk());

    expect($html)->toContain('data-currency-list')
        ->and($html)->toContain('data-currency-search')
        ->and($html)->toContain('data-currency-summary')
        ->and($html)->toContain('data-currency-stale')
        ->and($html)->toContain('data-currency-base')
        ->and($html)->toContain('data-currency-convert')
        ->and($html)->toContain('data-currency-filters')
        ->and($html)->toContain('data-currency-sort')
        ->and($html)->toContain('data-currency-more')
        ->and(substr_count($html, 'class="skeleton-list__row"'))->toBe(6);
});

test('the currencies page links to the region settings the same currency lives in', function () {
    $html = currenciesContent($this->get('/currencies')->assertOk());

    expect($html)->toContain('href="'.route('settings.language').'"');
});

test('the sidebar links to the currencies page', function () {
    $this->get('/dashboard')
        ->assertOk()
        ->assertSee('href="'.route('currencies').'"', false)
        ->assertSee(__('ui.nav.currencies'));
});

test('the currencies page is translated in every locale', function (string $locale) {
    $html = currenciesContent($this->withUnencryptedCookie('locale', $locale)->get('/currencies')->assertOk());
    $dictionary = require lang_path("{$locale}/ui.php");

    expect($html)->not->toContain('ui.currencies.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'currencies.title')))
        ->and($html)->toContain(e(Arr::get($dictionary, 'currencies.search_placeholder')));

    foreach (currencyScriptKeys() as $key) {
        expect(Arr::get($dictionary, $key))->toBeString("{$locale}: {$key} is missing");
    }

    expect(Arr::get($dictionary, 'currencies.summary'))->toContain(':count')->toContain(':code')
        ->and(Arr::get($dictionary, 'currencies.col_rate'))->toContain(':code')
        ->and(Arr::get($dictionary, 'currencies.shown'))->toContain(':shown')->toContain(':total');

    expect(Arr::get($dictionary, 'currencies.rate'))
        ->toContain(':from')
        ->toContain(':amount')
        ->toContain(':to');
})->with(['en', 'ru', 'uz']);

test('the button on a row saves the currency the page quotes everything in', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;
    $eur = currencyRow('EUR');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['preferred_currency_id' => $eur->id])
        ->assertOk()
        ->assertJsonPath('data.currency.id', $eur->id);

    forgetAuthGuards();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/currencies')
        ->assertOk()
        ->assertJsonPath('preferred_code', 'EUR');
});
