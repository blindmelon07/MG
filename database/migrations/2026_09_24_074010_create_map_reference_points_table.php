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
        // GPS readings taken on campus, each paired with the spot on the
        // campus map where it was taken. Used to line phone GPS up with the map.
        Schema::create('map_reference_points', function (Blueprint $table) {
            $table->id();
            $table->string('label')->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy', 7, 2)->nullable();
            $table->decimal('x', 5, 2);
            $table->decimal('y', 5, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_reference_points');
    }
};
