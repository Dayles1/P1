<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verification_codes', function (Blueprint $table) {
            $table->id();

            // Nullable: a decoy row is never persisted for an unknown email
            // on the passwordless-login flow (anti-enumeration), but every
            // real code always belongs to a user.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();

            // login_2fa | passwordless_login | email_verification
            $table->string('purpose', 40);

            $table->string('code_hash');

            // Given to the client instead of a user id so an unauthenticated
            // login flow (2FA, passwordless) can address "which pending code
            // is this?" without trusting anything the client supplies about
            // who they claim to be. Not needed for email_verification, which
            // is addressed by the already-authenticated user instead.
            $table->string('challenge_token', 64)->nullable()->unique();

            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();

            $table->timestamps();

            $table->index(['user_id', 'purpose', 'consumed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_codes');
    }
};
