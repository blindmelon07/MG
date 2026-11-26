<?php

use Database\Seeders\FloorPlanSeeder;
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
        // Indoor floor plans, drawn by admins over an uploaded picture of the
        // building's floor sign. The kiosk walks visitors from the entrance
        // to an office's door along the hallways drawn here.
        Schema::create('floor_plans', function (Blueprint $table) {
            $table->id();
            // One plan per building for now: the kiosk routes on the floor
            // people walk in on.
            $table->foreignId('campus_location_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('floor', 100);
            $table->string('image_path')->nullable();
            // Plan size in "plan units" (x east, y south), and how big a unit is.
            $table->float('width');
            $table->float('depth');
            $table->float('meters_per_unit');
            // Where the plan's corners sit on the campus map (map percent).
            $table->float('site_x0');
            $table->float('site_y0');
            $table->float('site_x1');
            $table->float('site_y1');
            $table->json('rooms');
            $table->json('halls');
            $table->json('entrances');
            $table->timestamps();
        });

        // Plans that used to be written into resources/js/lib/floor-plans.ts
        // carry over, so offices already placed on them keep their rooms.
        (new FloorPlanSeeder)->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('floor_plans');
    }
};
