<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Models\ExchangeRate;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Setting\Models\Timezone;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Models\Wallet;
use App\Domain\Wallet\Services\WalletLedger;
use Database\Seeders\LanguageSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
| Every Feature test gets roles/settings/languages seeded automatically —
| nearly every controller in this app reads at least one of those.
| Deliberately NOT seeding timezones here (400+ rows, seconds per test);
| use timezoneRow() below on the rare test that needs a real one.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        $this->seed([RoleSeeder::class, SettingSeeder::class, LanguageSeeder::class]);
    })
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Domain helpers
|--------------------------------------------------------------------------
*/

function makeRole(string $code): Role
{
    return Role::query()->firstOrCreate(['code' => $code], ['name' => $code]);
}

function userWithRole(string $code, array $attributes = []): User
{
    $user = User::factory()->create($attributes);
    $user->roles()->attach(makeRole($code)->id);

    return $user->fresh();
}

/**
 * Opens (or reuses) the 1:1 conversation between two users, as `$from`.
 */
function startPrivateConversation(User $from, User $to): int
{
    return test()->actingAs($from, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$to->id],
    ])->json('data.id');
}

function timezoneRow(string $name = 'UTC'): Timezone
{
    return Timezone::query()->firstOrCreate(
        ['name' => $name],
        ['label' => $name, 'offset' => '+00:00', 'is_active' => true]
    );
}

/**
 * One currency, on demand. CurrencySeeder has all 166 of them, which is
 * more rows than any single test needs — the same reasoning as
 * timezoneRow() above.
 */
function currencyRow(string $code, int $decimals = 2, ?string $symbol = null): Currency
{
    return Currency::query()->firstOrCreate(
        ['code' => strtoupper($code)],
        [
            'name' => strtoupper($code),
            'symbol' => $symbol,
            'decimals' => $decimals,
            'is_active' => true,
        ]
    );
}

/**
 * A rate for one currency on one day, against the app currency.
 */
function rateRow(string $code, string $rate, ?string $date = null, int $decimals = 2): ExchangeRate
{
    return ExchangeRate::query()->updateOrCreate(
        [
            'currency_id' => currencyRow($code, $decimals)->id,
            'base_code' => 'USD',
            'rate_date' => $date ?? now()->toDateString(),
        ],
        [
            'rate' => $rate,
            'source' => 'test',
            'fetched_at' => now(),
        ]
    );
}

/**
 * Laravel's `Auth::guard('sanctum')` (a `RequestGuard`) caches the first
 * resolved user on the guard instance and returns it for every later
 * `->user()` call — including calls made with a DIFFERENT bearer token,
 * since nothing between two simulated requests in the same test naturally
 * clears it (unlike two real, separate HTTP requests, which each get a
 * fresh guard). Call this before authenticating as a second identity within
 * one test to avoid silently asserting against the wrong user's data.
 */
function forgetAuthGuards(): void
{
    app('auth')->forgetGuards();
}

/**
 * Creates a Sanctum token AND the `UserSession` row that a real login
 * flow would create alongside it — most session/request-log endpoints
 * need one to exist to return anything.
 *
 * @return array{0: string, 1: UserSession} [plainTextToken, session]
 */
function createUserSession(User $user): array
{
    $token = $user->createToken('test');

    $session = UserSession::create([
        'user_id' => $user->id,
        'personal_access_token_id' => $token->accessToken->id,
        'ip_address' => '127.0.0.1',
        'logged_in_at' => now(),
        'last_activity_at' => now(),
    ]);

    return [$token->plainTextToken, $session];
}

/**
 * Credentials for every payment provider, so the gateways consider
 * themselves configured. Provider HTTP is always faked in tests.
 */
function configurePaymentProviders(): void
{
    config([
        'payments.return_url' => 'https://app.test/payments/{payment}',
        'payments.providers.click' => [
            'service_id' => '1001',
            'merchant_id' => '2002',
            'merchant_user_id' => '3003',
            'secret_key' => 'click-secret',
            'checkout_url' => 'https://my.click.uz/services/pay',
            'api_url' => 'https://api.click.uz/v2/merchant',
        ],
        'payments.providers.payme' => [
            'merchant_id' => 'payme-merchant',
            'key' => 'payme-key',
            'checkout_url' => 'https://checkout.paycom.uz',
            'api_url' => 'https://checkout.paycom.uz/api',
            'account_key' => 'payment_id',
        ],
        'payments.providers.oneqr' => [
            'api_url' => 'https://api.oneqr.test',
            'api_key' => 'oneqr-key',
            'secret' => 'oneqr-secret',
        ],
    ]);
}

/**
 * A user's UZS wallet holding `$balance` tiyin, put there through the
 * ledger like any real top-up would be.
 */
function fundedWallet(User $user, int $balance): Wallet
{
    $wallet = Wallet::resolveFor($user, currencyRow('UZS'));

    if ($balance > 0) {
        app(WalletLedger::class)->credit($wallet, $balance, WalletTransactionType::Adjustment);
    }

    return $wallet;
}

/**
 * A group (or channel) created by `$creator` with `$members` in it.
 *
 * @param  array<int, User>  $members
 */
function startGroupConversation(User $creator, array $members, string $type = 'group', string $title = 'Team chat'): int
{
    return test()->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => $type,
        'title' => $title,
        'user_ids' => array_map(fn (User $member) => $member->id, $members),
    ])->assertOk()->json('data.id');
}

/**
 * Sends a text message as `$sender` and returns its id.
 */
function sendChatMessage(User $sender, int $conversationId, string $body = 'Hello', array $extra = []): int
{
    return test()->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => $body, ...$extra])
        ->assertCreated()
        ->json('data.id');
}
