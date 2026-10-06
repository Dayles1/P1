<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What a person tells everyone else about themselves on their public
     * profile: a job title, a short "about me", tags, and the contacts
     * they choose to share. The phone is hidden from others unless its
     * owner turns `phone_visible` on.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('position', 120)->nullable()->after('name');
            $table->string('bio', 200)->nullable()->after('position');

            /** Up to eight short tags ("Laravel", "Релизы"), shown under the bio. */
            $table->json('profile_tags')->nullable()->after('bio');

            $table->string('phone', 32)->nullable()->after('email');
            $table->boolean('phone_visible')->default(false)->after('phone');

            /** A Telegram username without the @. */
            $table->string('telegram', 64)->nullable()->after('phone_visible');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['position', 'bio', 'profile_tags', 'phone', 'phone_visible', 'telegram']);
        });
    }
};
