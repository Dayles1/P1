<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every payment in the system, whatever it pays for and however it is
     * paid: a wallet top-up through Click is a row here, and so is a cargo
     * paid from the wallet balance.
     *
     * `payable` is the business operation the money is for (the Wallet
     * itself for a top-up), `provider` is where the money comes from
     * (`wallet` for the internal balance).
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            /**
             * Public identifier. It is what providers are given as the
             * order reference, so it must not be guessable like the id.
             */
            $table->uuid()->unique();

            $table->foreignId('user_id')->constrained()->restrictOnDelete();

            $table->morphs('payable');

            $table->string('provider', 30);
            $table->foreignId('card_id')->nullable()->constrained()->restrictOnDelete();

            /** Minor units of the currency (tiyin for UZS). */
            $table->unsignedBigInteger('amount');
            $table->foreignId('currency_id')->constrained()->restrictOnDelete();

            $table->string('status', 20)->default('pending');

            /**
             * The provider's own id for this payment. Unique per provider,
             * so a callback that arrives twice can never attach one
             * provider transaction to two payments.
             */
            $table->string('provider_transaction_id')->nullable();

            /**
             * Supplied by the client so that retrying a request which
             * timed out returns the payment it already created.
             */
            $table->string('idempotency_key', 100)->nullable();

            $table->text('checkout_url')->nullable();

            /** Protocol state a provider needs echoed back (Payme times, etc). */
            $table->json('provider_payload')->nullable();

            $table->string('description')->nullable();
            $table->string('failure_reason')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();

            $table->unique(['provider', 'provider_transaction_id']);
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
