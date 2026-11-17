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
        // The semester a college or graduate subject is offered in. Null means
        // it's offered every semester.
        Schema::table('subjects', function (Blueprint $table) {
            $table->string('semester', 16)->nullable()->after('course_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn('semester');
        });
    }
};
