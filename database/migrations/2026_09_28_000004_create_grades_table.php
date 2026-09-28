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
        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('grading_system', 16);
            $table->string('school_year', 9);
            $table->string('term')->nullable();
            $table->string('subject_code')->nullable();
            $table->string('subject');
            $table->decimal('units', 4, 1)->nullable();
            $table->decimal('q1', 5, 2)->nullable();
            $table->decimal('q2', 5, 2)->nullable();
            $table->decimal('q3', 5, 2)->nullable();
            $table->decimal('q4', 5, 2)->nullable();
            $table->decimal('midterm', 5, 2)->nullable();
            $table->decimal('final_grade', 5, 2)->nullable();
            $table->string('remarks')->nullable();
            $table->foreignId('encoded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['student_id', 'school_year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};
