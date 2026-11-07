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
        // Students only see grades once they are posted. College grades a
        // teacher uploads wait for the registrar to approve them.
        Schema::table('grades', function (Blueprint $table) {
            $table->timestamp('approved_at')->nullable()->after('encoded_by');
            $table->foreignId('approved_by')->nullable()->after('approved_at')
                ->constrained('users')->nullOnDelete();
            $table->index(['grading_system', 'approved_at']);
        });

        // Grades already in the system were already visible to students.
        DB::table('grades')->update(['approved_at' => DB::raw('COALESCE(updated_at, CURRENT_TIMESTAMP)')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropIndex(['grading_system', 'approved_at']);
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn('approved_at');
        });
    }
};
