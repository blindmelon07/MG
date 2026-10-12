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
        Schema::table('teaching_assignments', function (Blueprint $table) {
            $table->string('education_level', 16)->nullable()->after('user_id');
            $table->string('grade_level')->nullable()->after('education_level');
        });

        // Best-effort backfill from the students already in each assignment's section.
        DB::table('teaching_assignments')->orderBy('id')->each(function (object $assignment) {
            $student = DB::table('students')
                ->where('section', $assignment->section)
                ->whereNotNull('education_level')
                ->first(['education_level', 'grade_level']);

            if ($student !== null) {
                DB::table('teaching_assignments')->where('id', $assignment->id)->update([
                    'education_level' => $student->education_level,
                    'grade_level' => $student->grade_level,
                ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teaching_assignments', function (Blueprint $table) {
            $table->dropColumn(['education_level', 'grade_level']);
        });
    }
};
