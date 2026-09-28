<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Temporary passwords used to be the student number, which anyone could guess.
     * Revoke every temporary password that hasn't been replaced yet; the registrar
     * issues random ones instead.
     */
    public function up(): void
    {
        DB::table('students')
            ->where('must_change_password', true)
            ->update(['password' => null, 'remember_token' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
