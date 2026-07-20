<?php

namespace Database\Factories;

use App\Models\ManualCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ManualCategory>
 */
class ManualCategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = rtrim(fake()->unique()->sentence(3), '.');

        return [
            'name' => $name,
            'slug' => str($name)->slug(),
            'description' => fake()->optional()->sentence(),
            'sort_order' => fake()->numberBetween(0, 10),
        ];
    }
}
