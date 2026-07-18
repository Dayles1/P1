<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_users', function (Blueprint $table) {
            $table->id();

            $table->foreignId('conversation_id')
                ->constrained('conversations')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('role')->default('member')->index(); // owner, admin, member

            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamp('muted_until')->nullable();
            $table->timestamp('last_read_at')->nullable();

            $table->unsignedBigInteger('last_read_message_id')->nullable()->index();

            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_hidden')->default(false);

            $table->unsignedInteger('unread_count')->default(0);
            $table->boolean('notifications_enabled')->default(true);

            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
            $table->index(['user_id', 'is_hidden']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_users');
    }
};