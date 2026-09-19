<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per currency per day, never overwritten in place: the rate
     * a price was converted at has to stay readable after the market
     * moves, and "yesterday's rate" is a question the app is expected to
     * be able to answer.
     */
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();

            $table->foreignId('currency_id')->constrained()->cascadeOnDelete();

            /*
             * The currency the rate is quoted against — the app currency
             * (system.base_currency_code, USD). Stored as a code rather
             * than an id so a row still reads on its own.
             */
            $table->string('base_code', 3);

            /** How many units of `currency_id` one unit of `base_code` buys. */
            $table->decimal('rate', 24, 10);

            $table->date('rate_date');
            $table->string('source', 50)->nullable();
            $table->timestamp('fetched_at')->nullable();

            $table->timestamps();

            $table->unique(['currency_id', 'base_code', 'rate_date']);
            $table->index(['base_code', 'rate_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};
