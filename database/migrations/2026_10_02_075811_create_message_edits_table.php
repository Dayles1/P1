<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every edit of a message, so "Details" can say when it was changed,
     * how many times and what it said before. One row per edit, holding
     * the text as it was just before that edit.
     */
    public function up(): void
    {
        Schema::create('message_edits', function (Blueprint $table) {
            $table->id();

            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();

            /** Who made the edit — usually the author, sometimes a moderator. */
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->longText('previous_body')->nullable();

            /** When the edit was made. */
            $table->timestamp('created_at')->nullable();

            $table->index(['message_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_edits');
    }
};
