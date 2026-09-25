<?php

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Models\Card;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    configurePaymentProviders();

    $this->user = User::factory()->create();
    [$this->token] = createUserSession($this->user);

    $this->api = fn () => $this->withHeader('Authorization', "Bearer {$this->token}");
});

test('binding a card through payme keeps only its token and masked number', function () {
    Http::fake([
        'checkout.paycom.uz/api' => Http::sequence()
            ->push(['result' => ['card' => ['number' => '860006******6311', 'expire' => '03/99', 'token' => 'payme-token', 'recurrent' => true, 'verify' => false]]])
            ->push(['result' => ['sent' => true, 'phone' => '99890*****31', 'wait' => 60000]])
            ->push(['result' => ['card' => ['number' => '860006******6311', 'expire' => '03/99', 'token' => 'payme-token', 'recurrent' => true, 'verify' => true]]]),
    ]);

    $id = ($this->api)()->postJson('/api/cards', [
        'provider' => 'payme',
        'card_number' => '8600 0691 9540 6311',
        'card_expiry' => '03/99',
    ])
        ->assertCreated()
        ->assertJsonPath('data.masked_pan', '860006******6311')
        ->assertJsonPath('data.phone', '99890*****31')
        ->assertJsonPath('data.is_verified', false)
        ->assertJsonMissingPath('data.token')
        ->json('data.id');

    Http::assertSent(fn (Request $request) => $request['method'] === 'cards.create'
        && $request['params']['card'] === ['number' => '8600069195406311', 'expire' => '0399']
        && $request->hasHeader('X-Auth', 'payme-merchant'));

    ($this->api)()->postJson("/api/cards/{$id}/verify", ['code' => '666666'])
        ->assertOk()
        ->assertJsonPath('data.is_verified', true);

    $card = Card::query()->findOrFail($id);
    $stored = json_encode(DB::table('cards')->where('id', $id)->first());

    expect($card->token)->toBe('payme-token')
        ->and($card->provider)->toBe(PaymentProvider::Payme)
        ->and($stored)->not->toContain('8600069195406311')
        ->and($stored)->not->toContain('payme-token');
});

test('binding a card through click masks the number itself', function () {
    Http::fake([
        'api.click.uz/v2/merchant/card_token/request' => Http::response([
            'error_code' => 0, 'error_note' => 'Success', 'card_token' => 'click-token', 'phone_number' => '99890***1234', 'temporary' => 0,
        ]),
    ]);

    ($this->api)()->postJson('/api/cards', [
        'provider' => 'click',
        'card_number' => '8600069195406311',
        'card_expiry' => '0399',
    ])
        ->assertCreated()
        ->assertJsonPath('data.masked_pan', '860006******6311');

    expect(Card::query()->sole()->token)->toBe('click-token');
});

test('the card number never reaches the request log', function () {
    Http::fake([
        'api.click.uz/*' => Http::response(['error_code' => 0, 'card_token' => 'click-token']),
    ]);

    ($this->api)()->postJson('/api/cards', [
        'provider' => 'click',
        'card_number' => '8600069195406311',
        'card_expiry' => '0399',
    ])->assertCreated();

    $log = RequestLog::query()->latest('id')->firstOrFail();

    expect(json_encode($log->getAttributes()))->not->toContain('8600069195406311')
        ->and(json_encode($log->body))->toContain('"card_number":"[REDACTED]"')
        ->and(json_encode($log->body))->toContain('"card_expiry":"[REDACTED]"');
});

test('a wrong confirmation code is the payer\'s to fix', function () {
    Http::fake([
        'checkout.paycom.uz/api' => Http::response(['error' => ['code' => -31103, 'message' => 'Wrong code']]),
    ]);

    $card = Card::query()->create([
        'user_id' => $this->user->id,
        'provider' => PaymentProvider::Payme,
        'token' => 'payme-token',
        'masked_pan' => '860006******6311',
    ]);

    ($this->api)()->postJson("/api/cards/{$card->id}/verify", ['code' => '000000'])
        ->assertUnprocessable()
        ->assertJsonPath('data.reason', 'Wrong code');

    expect($card->fresh()->isVerified())->toBeFalse();
});

test('a card can be removed by its owner, and is then no longer listed', function () {
    Http::fake(['api.click.uz/*' => Http::response(['error_code' => 0])]);

    $card = Card::query()->create([
        'user_id' => $this->user->id,
        'provider' => PaymentProvider::Click,
        'token' => 'click-token',
        'masked_pan' => '860006******6311',
        'verified_at' => now(),
    ]);

    ($this->api)()->getJson('/api/cards')->assertOk()->assertJsonCount(1, 'data');
    ($this->api)()->deleteJson("/api/cards/{$card->id}")->assertOk();
    ($this->api)()->getJson('/api/cards')->assertOk()->assertJsonCount(0, 'data');

    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE'
        && str_ends_with($request->url(), '/card_token/1001/click-token'));

    expect($card->fresh()->trashed())->toBeTrue();
});

test("someone else's card is not found", function () {
    $card = Card::query()->create([
        'user_id' => User::factory()->create()->id,
        'provider' => PaymentProvider::Click,
        'token' => 't',
        'masked_pan' => '860006******6311',
    ]);

    ($this->api)()->postJson("/api/cards/{$card->id}/verify", ['code' => '1'])->assertNotFound();
    ($this->api)()->deleteJson("/api/cards/{$card->id}")->assertNotFound();
});

test('a checkout-only provider cannot store cards', function () {
    ($this->api)()->postJson('/api/cards', [
        'provider' => 'oneqr',
        'card_number' => '8600069195406311',
        'card_expiry' => '0399',
    ])->assertUnprocessable()->assertJsonValidationErrors('provider');
});
