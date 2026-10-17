<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on the game's own database, not the main one.
     */
    protected $connection = 'city3';

    /**
     * Prices, safety nets and the race against history (gdd §4.9–§4.12,
     * §2.3, §10, §14). A world keeps its era log (`[{era, t}]`), its peak
     * population, its treasury state (`economy`: policies, loan, arrears,
     * chest, the 50-year happiness average, the tester flag) and the
     * leaderboard columns the server derives from them (`stars`, `lead`,
     * `ranked`). A building keeps the money actually paid for it (null:
     * saved before this, the client credits the list price), whether it is
     * mothballed, its organic growth, the era its level was finished in
     * and, while an upgrade builds, the level that keeps working.
     */
    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->table('worlds', function (Blueprint $table) {
            $table->unsignedInteger('peak_population')->default(0);
            $table->json('era_log')->nullable();
            $table->json('economy')->nullable();
            $table->unsignedTinyInteger('stars')->default(0);
            $table->integer('lead')->default(0);
            $table->boolean('ranked')->default(true);

            $table->index(['ranked', 'score']);
        });

        $schema->table('buildings', function (Blueprint $table) {
            $table->unsignedBigInteger('paid')->nullable();
            $table->boolean('mothballed')->default(false);
            $table->float('organic')->default(0);
            $table->unsignedTinyInteger('built_era')->nullable();
            $table->unsignedTinyInteger('from_level')->default(0);
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->table('buildings', function (Blueprint $table) {
            $table->dropColumn(['paid', 'mothballed', 'organic', 'built_era', 'from_level']);
        });

        $schema->table('worlds', function (Blueprint $table) {
            $table->dropIndex(['ranked', 'score']);
            $table->dropColumn(['peak_population', 'era_log', 'economy', 'stars', 'lead', 'ranked']);
        });
    }
};
