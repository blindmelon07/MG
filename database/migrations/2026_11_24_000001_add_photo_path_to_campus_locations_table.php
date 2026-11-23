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
        Schema::table('campus_locations', function (Blueprint $table) {
            // Photo shown on the kiosk's "Location Details" card.
            $table->string('photo_path')->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campus_locations', function (Blueprint $table) {
            $table->dropColumn('photo_path');
        });
    }
};
