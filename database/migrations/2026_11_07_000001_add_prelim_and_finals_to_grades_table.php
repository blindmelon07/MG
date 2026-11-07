<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * College grades in three periods: prelim, midterm and finals, with
     * final_grade as the subject's total grade.
     */
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->decimal('prelim', 5, 2)->nullable()->after('q4');
            $table->decimal('finals', 5, 2)->nullable()->after('midterm');
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropColumn(['prelim', 'finals']);
        });
    }
};
