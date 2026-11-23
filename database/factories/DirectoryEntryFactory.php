<?php

namespace Database\Factories;

use App\Models\DirectoryEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DirectoryEntry>
 */
class DirectoryEntryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category' => 'office',
            'name' => fake()->unique()->words(2, true).' Office',
            'description' => fake()->optional()->sentence(),
            'phone' => fake()->optional()->numerify('(056) ###-####'),
            'email' => fake()->optional()->safeEmail(),
            'office_hours' => null,
            'room' => null,
            'campus_location_id' => null,
            'sort_order' => 0,
        ];
    }

    public function hotline(): static
    {
        return $this->state(fn () => [
            'category' => 'hotline',
            'phone' => fake()->numerify('09#########'),
        ]);
    }
}
