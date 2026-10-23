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
        Schema::table('grade_audits', function (Blueprint $table) {
            // Who made the change, kept even after their account is deleted
            // (user_id is nulled then).
            $table->string('user_name')->nullable()->after('user_id');
            $table->string('user_role', 32)->nullable()->after('user_name');
        });

        DB::table('grade_audits')
            ->whereNotNull('user_id')
            ->orderBy('id')
            ->each(function (object $audit): void {
                $user = DB::table('users')->where('id', $audit->user_id)->first(['name', 'role']);

                if ($user !== null) {
                    DB::table('grade_audits')->where('id', $audit->id)->update([
                        'user_name' => $user->name,
                        'user_role' => $user->role,
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grade_audits', function (Blueprint $table) {
            $table->dropColumn(['user_name', 'user_role']);
        });
    }
};
