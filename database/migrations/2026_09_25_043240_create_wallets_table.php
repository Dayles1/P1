<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One internal balance per user per currency. The balance is a cache of
     * the ledger (`wallet_transactions`), kept on the row so it can be
     * locked and checked in one place when money leaves the wallet.
     */
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('currency_id')->constrained()->restrictOnDelete();

            /*
             * Minor units of the currency (tiyin for UZS), never a float or
             * a decimal string: an integer is what can be compared and
             * decremented atomically under a row lock. Unsigned so the
             * database itself refuses a negative balance.
             */
            $table->unsignedBigInteger('balance')->default(0);

            $table->timestamps();

            $table->unique(['user_id', 'currency_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};
