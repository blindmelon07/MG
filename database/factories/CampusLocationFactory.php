<?php

namespace Database\Factories;

use App\Models\CampusLocation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampusLocation>
 */
class CampusLocationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'description' => fake()->optional()->sentence(),
            'x' => fake()->randomFloat(2, 5, 95),
            'y' => fake()->randomFloat(2, 5, 95),
            'sort_order' => 0,
        ];
    }
}
