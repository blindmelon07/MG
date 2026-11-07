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
        // A teacher who advises one section for a school year.
        Schema::create('advisories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('education_level', 16);
            $table->string('grade_level', 32);
            $table->string('section', 100);
            $table->string('school_year', 9);
            $table->timestamps();

            // One adviser per section per school year.
            $table->unique(['education_level', 'grade_level', 'section', 'school_year'], 'advisories_section_year_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('advisories');
    }
};
