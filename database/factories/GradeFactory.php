<?php

namespace Database\Factories;

use App\Models\Grade;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Grade>
 */
class GradeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'student_id' => Student::factory(),
            'grading_system' => 'k12',
            'school_year' => '2026-2027',
            'term' => null,
            'subject' => fake()->randomElement(['Mathematics', 'English', 'Science', 'Filipino']),
            'q1' => 85,
            'q2' => 86,
            'q3' => 87,
            'q4' => 88,
            'final_grade' => 87,
            'remarks' => 'Passed',
        ];
    }
}
