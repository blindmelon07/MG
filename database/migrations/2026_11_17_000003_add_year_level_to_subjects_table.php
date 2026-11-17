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
        // The year level a college or graduate subject is meant for, e.g. "1st Year".
        // Null means any year level.
        Schema::table('subjects', function (Blueprint $table) {
            $table->string('year_level', 16)->nullable()->after('course_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn('year_level');
        });
    }
};
