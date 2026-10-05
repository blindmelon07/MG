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
        Schema::table('announcements', function (Blueprint $table) {
            // "none" lets an event go to personnel only.
            $table->enum('audience', ['all', 'targeted', 'none'])->default('all')->change();
            $table->json('personnel_roles')->nullable()->after('audience');
            $table->foreignId('campus_location_id')->nullable()->after('location')
                ->constrained()->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('campus_location_id');
            $table->dropColumn('personnel_roles');
            $table->enum('audience', ['all', 'targeted'])->default('all')->change();
        });
    }
};
