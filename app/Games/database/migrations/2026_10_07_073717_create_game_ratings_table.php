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
     * One rating (1–5 stars and an optional comment) per player per game.
     * `user_id` is the main application's user id (another database, so no
     * foreign key).
     */
    public function up(): void
    {
        Schema::connection($this->connection)->create('game_ratings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('game', 32);
            $table->unsignedTinyInteger('stars');
            $table->string('comment', 500)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'game']);
            $table->index(['game', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('game_ratings');
    }
};
