<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();

            $table->string('code', 3)->unique();
            $table->string('name');
            $table->string('symbol', 8)->nullable();

            /*
             * ISO 4217 minor units: how many fraction digits an amount in
             * this currency is written with. 2 for most, 0 for JPY/KRW/UZS
             * -style currencies, 3 for the Gulf dinars, 4 for CLF. Money is
             * rounded to this before it is ever shown or stored as a price.
             */
            $table->unsignedTinyInteger('decimals')->default(2);

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('currencies');
    }
};
