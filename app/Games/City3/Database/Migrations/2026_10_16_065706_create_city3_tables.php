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
     * "Летопись города 3": one world per player, every tile of its map with
     * coordinates, every building placed on it and its residents. Only the
     * player's progress is stored here — what a building costs, gives or
     * looks like lives in the content files (app/Games/City3/content) and is
     * referred to by `type`. `user_id` is the host application's user id,
     * kept as a plain number: the users table is in another database, so
     * there is no foreign key to it.
     */
    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        $schema->create('worlds', function (Blueprint $table) {
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
            $table->json('techs')->nullable();
            $table->json('research')->nullable();
            $table->json('blueprints')->nullable();
            $table->json('achievements')->nullable();
            $table->timestamps();

            $table->index('score');
        });

        $schema->create('tiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('worlds')->cascadeOnDelete();
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->string('biome', 32);
            $table->unsignedTinyInteger('elevation');
            $table->string('feature', 16)->nullable();

            $table->unique(['world_id', 'x', 'y']);
        });

        $schema->create('buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('worlds')->cascadeOnDelete();
            $table->unsignedInteger('uid');
            $table->string('type', 64);
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->unsignedTinyInteger('level')->default(1);
            $table->unsignedBigInteger('build_start')->default(0);
            $table->unsignedBigInteger('build_end')->default(0);
            $table->json('style')->nullable();
            $table->json('district')->nullable();
            $table->timestamps();

            $table->unique(['world_id', 'uid']);
            $table->index(['world_id', 'type']);
        });

        $schema->create('npcs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('world_id')->constrained('worlds')->cascadeOnDelete();
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

        $schema->dropIfExists('npcs');
        $schema->dropIfExists('buildings');
        $schema->dropIfExists('tiles');
        $schema->dropIfExists('worlds');
    }
};
