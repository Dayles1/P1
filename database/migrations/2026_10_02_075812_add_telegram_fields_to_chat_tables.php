<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a Telegram-like chat needs beyond the original schema:
     *
     * - who pinned a message (for its details);
     * - a group description;
     * - per member: their own archive, "mark as unread", history cleared
     *   for them only, and when they pinned the chat (pinned chats are
     *   listed in the order they were pinned).
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('pinned_by')->nullable()->after('pinned_at')->constrained('users')->nullOnDelete();
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->string('description', 255)->nullable()->after('title');
        });

        Schema::table('conversation_users', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->after('is_pinned');
            $table->timestamp('archived_at')->nullable()->after('is_hidden');
            $table->boolean('marked_unread')->default(false)->after('unread_count');

            /** Messages up to and including this id are hidden for this member ("Clear history"). */
            $table->unsignedBigInteger('cleared_up_to_message_id')->nullable()->after('last_read_message_id');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_users', function (Blueprint $table) {
            $table->dropColumn(['pinned_at', 'archived_at', 'marked_unread', 'cleared_up_to_message_id']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pinned_by');
        });
    }
};
