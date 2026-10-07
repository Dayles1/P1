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
     * "City of Eras": one world per player, every tile of its map with
     * coordinates, every building placed on it and its residents. Only
     * the player's progress is stored here — what a building costs, gives
     * or looks like lives in the content files
     * (resources/games/content/epochs) and is referred to by `type`.
     */
    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->create('epochs_worlds', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedInteger('seed');
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->string('epoch', 32);
            $table->unsignedTinyInteger('epoch_index')->default(0);
            $table->unsignedSmallInteger('year');
            $table->unsignedBigInteger('time')->default(0);
            $table->unsignedInteger('population')->default(0);
            $table->unsignedTinyInteger('happiness')->default(50);
            $table->unsignedInteger('score')->default(0);
            $table->json('resources');
            $table->string('weather', 32);
            $table->unsignedBigInteger('weather_until')->default(0);
            $table->unsignedBigInteger('next_event_at')->default(0);
            $table->json('moods');
            $table->unsignedInteger('next_uid')->default(1);
            $table->json('stats');
            $table->timestamps();

            $table->index('score');
        });

        $schema->create('epochs_tiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('epochs_worlds')->cascadeOnDelete();
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->string('biome', 32);
            $table->unsignedTinyInteger('elevation');
            $table->string('feature', 16)->nullable();

            $table->unique(['world_id', 'x', 'y']);
        });

        $schema->create('epochs_buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('epochs_worlds')->cascadeOnDelete();
            $table->unsignedInteger('uid');
            $table->string('type', 64);
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->unsignedTinyInteger('level')->default(1);
            $table->unsignedBigInteger('build_start')->default(0);
            $table->unsignedBigInteger('build_end')->default(0);
            $table->timestamps();

            $table->unique(['world_id', 'uid']);
            $table->index(['world_id', 'type']);
        });

        $schema->create('epochs_npcs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('epochs_worlds')->cascadeOnDelete();
            $table->unsignedInteger('uid');
            $table->string('type', 32);
            $table->string('name', 80);
            $table->unsignedTinyInteger('age');
            $table->unsignedInteger('home_uid');
            $table->unsignedInteger('work_uid')->nullable();
            $table->decimal('x', 8, 2);
            $table->decimal('y', 8, 2);
            $table->string('activity', 16);
            $table->float('offset')->default(0);

            $table->unique(['world_id', 'uid']);
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->dropIfExists('epochs_npcs');
        $schema->dropIfExists('epochs_buildings');
        $schema->dropIfExists('epochs_tiles');
        $schema->dropIfExists('epochs_worlds');
    }
};
