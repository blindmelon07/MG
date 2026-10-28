<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // A student's level, year, course and section in one school year.
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('school_year', 9);
            $table->string('education_level', 16)->nullable();
            $table->string('grade_level')->nullable();
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->string('section')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'school_year']);
            $table->index(['school_year', 'section']);
        });

        // Until now a student had one level and section for every year, so record
        // that for the current year and each year they have grades in.
        $now = now();
        $current = DB::table('school_years')->where('is_current', true)->value('name');
        $gradeYears = DB::table('grades')->select('student_id', 'school_year')->distinct()->get()->groupBy('student_id');

        foreach (DB::table('students')->get(['id', 'education_level', 'grade_level', 'section']) as $student) {
            $years = collect($gradeYears->get($student->id, []))->pluck('school_year')->push($current)->filter()->unique();

            DB::table('enrollments')->insert($years->map(fn (string $year) => [
                'student_id' => $student->id,
                'school_year' => $year,
                'education_level' => $student->education_level,
                'grade_level' => $student->grade_level,
                'section' => $student->section,
                'created_at' => $now,
                'updated_at' => $now,
            ])->values()->all());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};
