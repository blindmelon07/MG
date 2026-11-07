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
        // Notices are an audit trail: they stay when the adviser is removed,
        // so each one keeps its own copy of the section and sender.
        Schema::table('suspension_notices', function (Blueprint $table) {
            $table->string('education_level', 16)->nullable()->after('sent_by');
            $table->string('grade_level', 32)->nullable()->after('education_level');
            $table->string('section', 100)->nullable()->after('grade_level');
            $table->string('school_year', 9)->nullable()->after('section');
            $table->string('sent_by_name')->nullable()->after('school_year');
        });

        DB::table('suspension_notices')->orderBy('id')->each(function (object $notice) {
            $advisory = DB::table('advisories')->where('id', $notice->advisory_id)->first();
            $sender = $notice->sent_by ? DB::table('users')->where('id', $notice->sent_by)->first() : null;

            DB::table('suspension_notices')->where('id', $notice->id)->update([
                'education_level' => $advisory?->education_level,
                'grade_level' => $advisory?->grade_level,
                'section' => $advisory?->section,
                'school_year' => $advisory?->school_year,
                'sent_by_name' => $sender?->name,
            ]);
        });

        Schema::table('suspension_notices', function (Blueprint $table) {
            $table->dropForeign(['advisory_id']);
        });

        Schema::table('suspension_notices', function (Blueprint $table) {
            $table->foreignId('advisory_id')->nullable()->change();
            $table->foreign('advisory_id')->references('id')->on('advisories')->nullOnDelete();
            $table->index(['school_year', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('suspension_notices')->whereNull('advisory_id')->delete();

        Schema::table('suspension_notices', function (Blueprint $table) {
            $table->dropIndex(['school_year', 'created_at']);
            $table->dropForeign(['advisory_id']);
        });

        Schema::table('suspension_notices', function (Blueprint $table) {
            $table->foreignId('advisory_id')->nullable(false)->change();
            $table->foreign('advisory_id')->references('id')->on('advisories')->cascadeOnDelete();
            $table->dropColumn(['education_level', 'grade_level', 'section', 'school_year', 'sent_by_name']);
        });
    }
};
