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
        // The registrar can send a pending college grade back to the teacher
        // with a reason instead of approving it.
        Schema::table('grades', function (Blueprint $table) {
            $table->timestamp('returned_at')->nullable()->after('approved_by');
            $table->foreignId('returned_by')->nullable()->after('returned_at')
                ->constrained('users')->nullOnDelete();
            $table->string('return_reason', 255)->nullable()->after('returned_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropConstrainedForeignId('returned_by');
            $table->dropColumn(['returned_at', 'return_reason']);
        });
    }
};
