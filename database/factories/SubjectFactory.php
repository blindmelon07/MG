<?php

namespace Database\Factories;

use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subject>
 */
class SubjectFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => null,
            'name' => fake()->unique()->randomElement(['Mathematics', 'Science', 'English', 'Filipino', 'Araling Panlipunan', 'MAPEH', 'Values Education', 'TLE']),
            'education_level' => 'jhs',
            'units' => null,
        ];
    }
}
