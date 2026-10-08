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
     * What the player carries (`inventory`: the slots, empty ones as null)
     * and which trees, rocks and finds they have used up (`harvested`:
     * id and when — the browser grows them back after a while).
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->json('inventory')->nullable()->after('yaw');
            $table->json('harvested')->nullable()->after('inventory');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->dropColumn(['inventory', 'harvested']);
        });
    }
};
