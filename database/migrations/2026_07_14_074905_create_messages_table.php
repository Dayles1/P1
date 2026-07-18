<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('parent_message_id')
                ->nullable()
                ->constrained('messages')
                ->nullOnDelete();

            $table->string('type')->default('text')->index();

            $table->longText('body')->nullable();
            $table->json('meta')->nullable();

            $table->timestamp('edited_at')->nullable();
            $table->timestamp('deleted_at')->nullable();

            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
            $table->index(['conversation_id', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};