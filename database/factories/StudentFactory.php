<?php

namespace Database\Factories;

use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Student>
 */
class StudentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'student_number' => fake()->unique()->numerify('LRN-########'),
            'grade_level' => fake()->randomElement(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']),
            'section' => fake()->randomElement(['St. Thomas', 'St. Peter', 'St. Paul']),
            'phone_number' => null,
            'status' => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'inactive',
        ]);
    }
}
