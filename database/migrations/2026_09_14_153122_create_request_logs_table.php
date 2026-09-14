<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_session_id')
                ->nullable()
                ->constrained('user_sessions')
                ->nullOnDelete();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('method', 10);
            $table->string('path', 2048);
            $table->string('route_name')->nullable();

            $table->unsignedSmallInteger('status_code')->nullable();

            $table->json('query')->nullable();
            $table->json('headers')->nullable();
            $table->json('body')->nullable();
            $table->boolean('body_truncated')->default(false);

            $table->json('response_headers')->nullable();
            $table->json('response_body')->nullable();
            $table->boolean('response_truncated')->default(false);

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->unsignedInteger('duration_ms')->nullable();

            $table->timestamp('created_at')->nullable();

            $table->index(['user_session_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['status_code']);
            $table->index(['method']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_logs');
    }
};
