<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * People a user has blocked, as in Telegram: a blocked person can no
     * longer write to them in a private chat, and nothing they do reaches
     * the blocker as a notification.
     */
    public function up(): void
    {
        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();

            /** Who blocked. */
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            /** Who is blocked. */
            $table->foreignId('blocked_user_id')->constrained('users')->cascadeOnDelete();

            $table->timestamp('created_at')->nullable();

            $table->unique(['user_id', 'blocked_user_id']);
            $table->index('blocked_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_blocks');
    }
};
