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
        // Manuals are listed in this order within their category.
        Schema::table('manuals', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('status');
        });

        // Number the existing manuals alphabetically, the order they were shown in until now.
        $byCategory = DB::table('manuals')->orderBy('title')->get(['id', 'manual_category_id'])->groupBy('manual_category_id');

        foreach ($byCategory as $manuals) {
            foreach ($manuals->values() as $index => $manual) {
                DB::table('manuals')->where('id', $manual->id)->update(['sort_order' => $index + 1]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('manuals', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
