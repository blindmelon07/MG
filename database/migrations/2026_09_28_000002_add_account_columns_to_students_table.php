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
        Schema::table('students', function (Blueprint $table) {
            $table->string('grading_system', 16)->default('k12')->after('section');
            $table->string('password')->nullable()->after('status');
            $table->boolean('must_change_password')->default(true)->after('password');
            $table->rememberToken()->after('must_change_password');
            $table->timestamp('last_login_at')->nullable()->after('remember_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['grading_system', 'password', 'must_change_password', 'remember_token', 'last_login_at']);
        });
    }
};
