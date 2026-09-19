<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A price is what its owner typed, in the currency they chose. That
     * pair is the price — it is never recomputed, so a seller asking
     * 100 USD is still asking 100 USD after the market moves; every
     * other currency is derived from it at read time.
     *
     * The `base_*` columns are a snapshot, not the truth: what the price
     * was worth in the app currency on the day it was set, kept so that
     * reporting and sorting across currencies have a stable number and
     * so the rate behind a conversion can be shown after the fact.
     */
    public function up(): void
    {
        Schema::create('prices', function (Blueprint $table) {
            $table->id();

            $table->morphs('priceable');

            $table->string('currency_code', 3);
            $table->decimal('amount', 20, 4);

            $table->string('base_code', 3);

            /*
             * Nullable because the price is not: if the rate table has
             * nothing for this currency yet, the amount the owner typed
             * is still recorded, just without a snapshot beside it.
             */
            $table->decimal('base_amount', 24, 8)->nullable();
            $table->decimal('base_rate', 24, 10)->nullable();
            $table->date('rate_date')->nullable();

            /** Which price this is — 'regular', 'sale', ... */
            $table->string('type', 30)->default('regular');

            /*
             * Superseded prices are kept rather than updated: the old
             * amount, and the rate it was set at, are part of the record.
             */
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(
                ['priceable_type', 'priceable_id', 'type', 'is_active'],
                'prices_priceable_type_active_index'
            );

            $table->foreign('currency_code')
                ->references('code')
                ->on('currencies')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prices');
    }
};
