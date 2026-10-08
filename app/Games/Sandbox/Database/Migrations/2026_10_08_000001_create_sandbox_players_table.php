<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on the Sandbox's own database, not the main one.
     */
    protected $connection = 'sandbox';

    /**
     * Where each player's character stands. `user_id` is the host
     * application's user id, kept as a plain number: the users table is in
     * another database, so there is no foreign key.
     */
    public function up(): void
    {
        Schema::connection($this->connection)->create('players', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->float('x');
            $table->float('y');
            $table->float('z');
            $table->float('yaw')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('players');
    }
};
