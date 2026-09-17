<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('conversation_id')->nullable()->after('data');
            $table->unsignedBigInteger('message_id')->nullable()->after('conversation_id');
            $table->index(
                ['notifiable_type', 'notifiable_id', 'conversation_id'],
                'notifications_notifiable_conversation_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_notifiable_conversation_index');
            $table->dropColumn(['conversation_id', 'message_id']);
        });
    }
};
