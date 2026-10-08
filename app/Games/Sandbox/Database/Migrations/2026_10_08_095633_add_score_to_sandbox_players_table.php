<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on the Sandbox's own database, not the main one.
     */
    protected $connection = 'sandbox';

    /**
     * The player's score for the leaderboard (see App\Games\Sandbox\Score),
     * worked out on every save. Characters saved before it start at 0 and
     * get theirs on their next save.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->unsignedInteger('score')->default(0)->after('stats');
            $table->index(['score', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->dropIndex(['score', 'updated_at']);
            $table->dropColumn('score');
        });
    }
};
