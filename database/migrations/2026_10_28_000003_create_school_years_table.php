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
        Schema::create('school_years', function (Blueprint $table) {
            $table->id();
            $table->string('name', 9)->unique();
            $table->boolean('is_current')->default(false);
            $table->timestamps();
        });

        // Every school year already used by a grade or teaching assignment, plus this one.
        $now = now();
        $current = $now->month >= 6 ? $now->year.'-'.($now->year + 1) : ($now->year - 1).'-'.$now->year;

        $names = DB::table('grades')->distinct()->pluck('school_year')
            ->merge(DB::table('teaching_assignments')->distinct()->pluck('school_year'))
            ->push($current)
            ->filter(fn ($name) => is_string($name) && preg_match('/^\d{4}-\d{4}$/', $name))
            ->unique()
            ->sort();

        DB::table('school_years')->insert($names->map(fn (string $name) => [
            'name' => $name,
            'is_current' => $name === $current,
            'created_at' => $now,
            'updated_at' => $now,
        ])->values()->all());
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('school_years');
    }
};
