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
        Schema::table('students', function (Blueprint $table) {
            $table->string('education_level', 16)->nullable()->after('student_number');
        });

        // Best-effort backfill from the free-text grade level used until now.
        DB::table('students')->whereIn('grade_level', ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'])
            ->update(['education_level' => 'jhs']);
        DB::table('students')->whereIn('grade_level', ['Grade 11', 'Grade 12'])
            ->update(['education_level' => 'shs']);
        DB::table('students')->whereNull('education_level')->where('grading_system', 'college')
            ->update(['education_level' => 'college']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('education_level');
        });
    }
};
