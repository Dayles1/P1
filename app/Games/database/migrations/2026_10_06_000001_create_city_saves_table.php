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
     * One saved city per player. `user_id` is the main application's user
     * id, kept as a plain number: the users table is in another database,
     * so there is no foreign key — the id is the only thing the two share.
     * The whole simulation runs in the browser and is saved here as one
     * JSON document; epoch, year, population and score are copied out of
     * it so the Games menu can show progress without parsing it.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->create('city_saves', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedTinyInteger('epoch')->default(0);
            $table->unsignedSmallInteger('year')->default(1000);
            $table->unsignedInteger('population')->default(0);
            $table->unsignedInteger('score')->default(0);
            $table->longText('state');
            $table->timestamps();

            $table->index('score');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('city_saves');
    }
};
