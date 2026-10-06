<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Votes in chat polls. The poll itself (question, options, whether it
     * is anonymous or multiple-choice, when it was closed) lives in the
     * poll message's `meta.poll`; options are referred to by their index
     * there.
     */
    public function up(): void
    {
        Schema::create('poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('option_id');
            $table->timestamp('created_at')->nullable();

            $table->unique(['message_id', 'user_id', 'option_id']);
            $table->index(['message_id', 'option_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('poll_votes');
    }
};
