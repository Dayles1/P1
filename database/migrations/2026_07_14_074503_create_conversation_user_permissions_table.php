<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_user_permissions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('conversation_user_id')
                ->constrained('conversation_users')
                ->cascadeOnDelete();

            $table->string('permission_key')->index();
            // send_message, edit_message, delete_message, pin_message, add_member, remove_member, manage_settings

            $table->boolean('is_allowed')->default(true);

            $table->timestamps();

            // $table->unique(['conversation_user_id', 'permission_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_user_permissions');
    }
};