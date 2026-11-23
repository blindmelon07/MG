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
        Schema::table('directory_entries', function (Blueprint $table) {
            // A room key from the building's floor plan (resources/js/lib/floor-plans.ts),
            // so the kiosk can walk visitors to the office door.
            $table->string('floor_room', 50)->nullable()->after('room');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('directory_entries', function (Blueprint $table) {
            $table->dropColumn('floor_room');
        });
    }
};
