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
     * The hero (class, gender, level, experience and the free points put
     * into attributes), the mana left, and what the player has learnt:
     * knowledge points and the recipes researched. Characters saved before
     * have none and pick a class on their next visit.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->json('hero')->nullable()->after('yaw');
            $table->float('mana')->nullable()->after('health');
            $table->json('research')->nullable()->after('stats');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->dropColumn(['hero', 'mana', 'research']);
        });
    }
};
