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
        // The kiosk's School Directory: offices (with where to find them on
        // the map) and hotlines. Buildings come from campus_locations.
        Schema::create('directory_entries', function (Blueprint $table) {
            $table->id();
            $table->string('category', 20); // office | hotline
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('office_hours')->nullable();
            // Where inside the building, e.g. "Ground floor, beside the Cashier".
            $table->string('room')->nullable();
            $table->foreignId('campus_location_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('directory_entries');
    }
};
