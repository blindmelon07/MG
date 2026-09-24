<?php

namespace Database\Factories;

use App\Models\MapReferencePoint;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MapReferencePoint>
 */
class MapReferencePointFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'label' => fake()->optional()->words(2, true),
            // Around Aemilianum College, Sorsogon City
            'latitude' => fake()->randomFloat(7, 12.9695, 12.9712),
            'longitude' => fake()->randomFloat(7, 123.9930, 123.9950),
            'accuracy' => fake()->randomFloat(2, 3, 20),
            'x' => fake()->randomFloat(2, 0, 100),
            'y' => fake()->randomFloat(2, 0, 100),
        ];
    }
}
