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
        // College and graduate subjects belong to a course; without one they're
        // general education subjects taken in every course.
        Schema::table('subjects', function (Blueprint $table) {
            $table->foreignId('course_id')->nullable()->after('education_level')->constrained()->nullOnDelete();

            // Two courses can each have a subject with the same name.
            $table->dropUnique(['name', 'education_level']);
            $table->unique(['name', 'education_level', 'course_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropUnique(['name', 'education_level', 'course_id']);
            $table->dropConstrainedForeignId('course_id');
            $table->unique(['name', 'education_level']);
        });
    }
};
