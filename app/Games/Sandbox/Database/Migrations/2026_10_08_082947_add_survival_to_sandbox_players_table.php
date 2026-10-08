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
     * How the character is doing: `health` (null for a character saved
     * before there was health — the game treats it as full), the armour it
     * wears (`equipment`: head, body and feet) and what the player has done
     * so far (`stats`: creatures beaten, trees felled and so on).
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->float('health')->nullable()->after('yaw');
            $table->json('equipment')->nullable()->after('inventory');
            $table->json('stats')->nullable()->after('placed');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->dropColumn(['health', 'equipment', 'stats']);
        });
    }
};
