<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            /*
             * The currency this user reads prices in and prices things
             * with. Null means "whatever the app currency is" — the same
             * shape as `locale` and `timezone_id` next to it.
             */
            $table->foreignId('preferred_currency_id')
                ->nullable()
                ->after('timezone_source')
                ->constrained('currencies')
                ->nullOnDelete();

            /** Currency ids this user pinned, in their own order. */
            $table->json('favorite_currency_ids')
                ->nullable()
                ->after('preferred_currency_id');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preferred_currency_id');
            $table->dropColumn('favorite_currency_ids');
        });
    }
};
