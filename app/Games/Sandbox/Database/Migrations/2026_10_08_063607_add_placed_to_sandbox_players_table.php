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
     * What the player has put down in the world (campfires): type and
     * where.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->json('placed')->nullable()->after('harvested');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('players', function (Blueprint $table) {
            $table->dropColumn('placed');
        });
    }
};
