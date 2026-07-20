<?php

namespace Database\Factories;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Announcement>
 */
class AnnouncementFactory extends Factory
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
            'created_by' => User::factory(),
            'title' => $title,
            'slug' => str($title)->slug(),
            'content' => fake()->paragraphs(2, true),
            'type' => 'announcement',
            'event_start_at' => null,
            'event_end_at' => null,
            'location' => null,
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

    public function event(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'event',
            'event_start_at' => now()->addDays(3),
            'event_end_at' => now()->addDays(3)->addHours(2),
            'location' => fake()->streetAddress(),
        ]);
    }
}
