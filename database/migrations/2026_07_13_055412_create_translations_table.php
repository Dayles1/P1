<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void
    {
        Schema::create('translations', function (Blueprint $table): void {
            $table->id();

            $table->string('translatable_type');
            $table->unsignedBigInteger('translatable_id');

            $table->string('field', 50);
            $table->string('locale', 10);
            $table->text('value');

            $table->timestamps();

            $table->unique([
                'translatable_type',
                'translatable_id',
                'field',
                'locale',
            ], 'translations_unique');

            $table->index(['locale']);
            $table->index(['translatable_type', 'translatable_id']);
        });
    }


    public function down(): void
    {
        Schema::dropIfExists('translations');
    }
};
