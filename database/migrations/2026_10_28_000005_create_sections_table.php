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
        // The sections offered for each year level, from JHS to graduate school.
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('education_level', 16);
            $table->string('grade_level');
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['education_level', 'grade_level', 'name']);
        });

        // Start the list with the sections students are already in.
        $now = now();

        $existing = DB::table('students')
            ->whereNotNull('education_level')
            ->whereNotNull('grade_level')
            ->whereNotNull('section')
            ->select('education_level', 'grade_level', 'section')
            ->distinct()
            ->get()
            ->unique(fn ($row) => strtolower($row->education_level.'|'.$row->grade_level.'|'.trim($row->section)));

        DB::table('sections')->insert($existing->map(fn ($row) => [
            'education_level' => $row->education_level,
            'grade_level' => $row->grade_level,
            'name' => trim($row->section),
            'created_at' => $now,
            'updated_at' => $now,
        ])->values()->all());
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sections');
    }
};
