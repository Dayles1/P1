<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The wallet ledger. A row is written only when the balance actually
     * changes, in the same transaction as the change, and is never updated
     * afterwards — anything still waiting on a provider is a pending
     * Payment, not a ledger row.
     *
     * The sum of `amount` over a wallet is its balance.
     */
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('wallet_id')
                ->constrained('wallets')
                ->restrictOnDelete();

            /** deposit, payment, refund, adjustment */
            $table->string('type', 20);

            /** Signed, in minor units: positive in, negative out. */
            $table->bigInteger('amount');

            $table->unsignedBigInteger('balance_before');
            $table->unsignedBigInteger('balance_after');

            /*
             * The payment behind the movement; its `payable` says which
             * business operation it was for. Null only for manual
             * adjustments.
             */
            $table->foreignId('payment_id')
                ->nullable()
                ->constrained('payments')
                ->restrictOnDelete();

            $table->string('description')->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            /*
             * A payment moves a wallet at most once per kind of movement,
             * enforced by the database rather than trusted to the code.
             */
            $table->unique(['payment_id', 'type']);
            $table->index(['wallet_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
