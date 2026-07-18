<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();

            $table->string('type')->index(); // private, group, support, bot
            $table->string('title')->nullable();
            $table->string('avatar')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->unsignedBigInteger('last_message_id')->nullable()->index();
            $table->timestamp('last_message_at')->nullable()->index();

            $table->boolean('is_locked')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->boolean('is_pinned')->default(false);

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['type', 'is_locked', 'is_archived']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};