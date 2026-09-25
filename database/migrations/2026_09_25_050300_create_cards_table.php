<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A card a user has bound through a payment provider.
     *
     * Only the provider's token and what is safe to show (masked number,
     * expiry) live here. The full card number and the CVV are passed
     * straight through to the provider when the card is bound and are
     * never written anywhere on our side.
     */
    public function up(): void
    {
        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();

            $table->string('provider', 30);

            /** The provider's token for the card, stored encrypted. */
            $table->text('token');

            /** e.g. 860006******1234 — as the provider returned it. */
            $table->string('masked_pan', 32);
            $table->string('expiry', 5)->nullable();

            /** Where the provider sent the confirmation code, masked. */
            $table->string('phone', 32)->nullable();

            /*
             * A card is usable only once the owner has confirmed it with
             * the code the provider sent them.
             */
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('last_used_at')->nullable();

            $table->timestamps();

            /*
             * Soft deleted, because payments made with a removed card
             * still point at it.
             */
            $table->softDeletes();

            $table->index(['user_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cards');
    }
};
