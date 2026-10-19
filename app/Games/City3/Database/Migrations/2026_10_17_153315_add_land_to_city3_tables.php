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
     * The player's land (gdd §5.2, §14): how many expansion strips were
     * bought west (`land_left`) and east (`land_right`) of the starting
     * columns, 0..7 each. They only ever grow; the score counts them.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->table('worlds', function (Blueprint $table) {
            $table->unsignedTinyInteger('land_left')->default(0);
            $table->unsignedTinyInteger('land_right')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('worlds', function (Blueprint $table) {
            $table->dropColumn(['land_left', 'land_right']);
        });
    }
};
