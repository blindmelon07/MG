<?php

namespace Database\Factories;

use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Manual>
 */
class ManualFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->sentence(4);

        return [
            'manual_category_id' => ManualCategory::factory(),
            'created_by' => User::factory(),
            'title' => $title,
            'slug' => str($title)->slug(),
            'content' => fake()->paragraphs(3, true),
            'status' => 'draft',
            'published_at' => null,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'published',
            'published_at' => now(),
        ]);
    }
}
