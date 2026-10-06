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
        // 360° photos taken around campus. A visitor's phone shows the one
        // taken nearest to where it is, turned to match its compass.
        Schema::create('campus_panoramas', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->string('path');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            // Where north sits across the photo, in degrees from its left
            // edge (0–360). Set by an admin; cameras rarely record it.
            $table->decimal('north_offset', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campus_panoramas');
    }
};
