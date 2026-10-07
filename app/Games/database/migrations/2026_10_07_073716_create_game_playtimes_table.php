<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on the games database, not the main one.
     */
    protected $connection = 'games';

    /**
     * How long each player has played each game, counted by the server from
     * the SPA's once-a-minute heartbeat. `user_id` is the main application's
     * user id (another database, so no foreign key).
     */
    public function up(): void
    {
        Schema::connection($this->connection)->create('game_playtimes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('game', 32);
            $table->unsignedInteger('seconds')->default(0);
            $table->timestamp('last_ping_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'game']);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('game_playtimes');
    }
};
