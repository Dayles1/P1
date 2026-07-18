<?php

use App\Domain\Ban\Enums\BanStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bans', function (Blueprint $table) {
            $table->id();

            $table->morphs('bannable');

            $table->foreignId('banned_by')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('unbanned_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('reason')->nullable();

            $table->timestamp('banned_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('unbanned_at')->nullable();

            $table->string('status')->default(BanStatus::Active->value);

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(['bannable_type', 'bannable_id']);
            $table->index('status');
            $table->index('ends_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bans');
    }
};