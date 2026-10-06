<?php

namespace Database\Factories;

use App\Models\CampusPanorama;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampusPanorama>
 */
class CampusPanoramaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->optional()->words(2, true),
            'path' => 'panoramas/'.fake()->uuid().'.jpg',
            // Around Aemilianum College, Sorsogon City
            'latitude' => fake()->randomFloat(7, 12.9695, 12.9712),
            'longitude' => fake()->randomFloat(7, 123.9930, 123.9950),
            'north_offset' => fake()->randomFloat(2, 0, 359),
        ];
    }
}
