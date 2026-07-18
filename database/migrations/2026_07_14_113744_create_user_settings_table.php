<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('timezone_id')->nullable()->constrained('timezones')->nullOnDelete();
            $table->string('timezone_source', 20)->nullable()->default('manual');

            $table->string('locale', 20)->nullable();
            $table->string('theme', 20)->nullable()->default('system');
            $table->string('date_format', 50)->nullable();
            $table->string('time_format', 20)->nullable()->default('24h');

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index(['timezone_id']);
            $table->index(['timezone_source']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};