<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('map_presences', function (Blueprint $table) {
            $table->id();
            // Hash of the random id the browser tab reports with, so one phone is one dot.
            $table->string('session_key', 64)->unique();
            $table->foreignId('student_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            // Map percent (0-100), never raw GPS coordinates.
            $table->float('x');
            $table->float('y');
            $table->timestamp('last_seen_at')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_presences');
    }
};
