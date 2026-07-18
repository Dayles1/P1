<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();

            $table->morphs('attachable');

            // avatar, post_image, document, etc.
            $table->string('collection')->default('default')->index();

            $table->string('disk')->default('public');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('filename')->nullable();
            $table->string('extension', 20)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->index([
                'attachable_type',
                'attachable_id',
                'collection',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};