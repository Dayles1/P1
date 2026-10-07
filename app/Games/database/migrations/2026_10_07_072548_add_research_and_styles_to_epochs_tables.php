<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on the games database, not the main one.
     */
    protected $connection = 'games';

    /**
     * "Летопись города 2": a world now also keeps its researched
     * technologies, the research under way, unlocked blueprints and
     * reached goals; a building keeps the player's style for it and, for a
     * district hall, the district's name and policy.
     *
     * Worlds of the first version cannot be read by the new rules (eras,
     * building levels and resources all changed), so they are removed and
     * every player starts afresh.
     */
    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        DB::connection($this->connection)->table('epochs_npcs')->delete();
        DB::connection($this->connection)->table('epochs_buildings')->delete();
        DB::connection($this->connection)->table('epochs_tiles')->delete();
        DB::connection($this->connection)->table('epochs_worlds')->delete();

        $schema->table('epochs_worlds', function (Blueprint $table) {
            $table->json('techs')->nullable();
            $table->json('research')->nullable();
            $table->json('blueprints')->nullable();
            $table->json('achievements')->nullable();
        });

        $schema->table('epochs_buildings', function (Blueprint $table) {
            $table->json('style')->nullable();
            $table->json('district')->nullable();
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->table('epochs_buildings', function (Blueprint $table) {
            $table->dropColumn(['style', 'district']);
        });

        $schema->table('epochs_worlds', function (Blueprint $table) {
            $table->dropColumn(['techs', 'research', 'blueprints', 'achievements']);
        });
    }
};
