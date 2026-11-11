<?php

namespace App\Notifications;

use App\Models\Student;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification as Notifier;

/**
 * Emails administrators when students are added, one at a time or by import.
 */
class StudentsAdded extends Notification implements ShouldQueue
{
    use Queueable;

    /** Students listed by name in an import email; the rest are counted. */
    private const LISTED = 20;

    /**
     * @param  list<array{name: string, student_number: string|null, grade_level: string|null, section: string|null}>  $students
     */
    public function __construct(
        public array $students,
        public string $schoolYear,
        public ?string $addedBy,
        public bool $imported = false,
    ) {
        $this->onConnection(config('queue.notifications'));
    }

    /**
     * Email every admin about the students just added.
     *
     * @param  iterable<Student>  $students
     */
    public static function send(iterable $students, string $schoolYear, ?User $addedBy, bool $imported = false): void
    {
        $students = collect($students)->map(fn (Student $student) => [
            'name' => $student->name,
            'student_number' => $student->student_number,
            'grade_level' => $student->grade_level,
            'section' => $student->section,
        ])->values()->all();

        if ($students === []) {
            return;
        }

        Notifier::send(
            static::recipients(),
            new static($students, $schoolYear, $addedBy?->name, $imported),
        );
    }

    /**
     * @return Collection<int, User>
     */
    public static function recipients(): Collection
    {
        return User::whereIn('role', ['super_admin', 'admin'])->get();
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = count($this->students);
        $by = $this->addedBy ?? 'Someone';

        $message = (new MailMessage)
            ->greeting('Hi '.($notifiable->name ?? 'there').',');

        if ($count === 1 && ! $this->imported) {
            $student = $this->students[0];

            return $message
                ->subject("New student added: {$student['name']}")
                ->line("{$by} added a student to S.Y. {$this->schoolYear}.")
                ->line("**Name:** {$student['name']}")
                ->line('**Student number:** '.($student['student_number'] ?? '—'))
                ->line('**Placement:** '.$this->placement($student))
                ->action('View students', route('admin.students.index', ['search' => $student['student_number'] ?? $student['name']]));
        }

        $students = $count === 1 ? '1 student' : "{$count} students";

        $message
            ->subject("New students imported: {$students}")
            ->line("{$by} imported {$students} into S.Y. {$this->schoolYear}.");

        foreach (array_slice($this->students, 0, self::LISTED) as $student) {
            $message->line('- '.$student['name']
                .($student['student_number'] !== null ? " ({$student['student_number']})" : '')
                .' — '.$this->placement($student));
        }

        if ($count > self::LISTED) {
            $message->line('…and '.($count - self::LISTED).' more.');
        }

        return $message->action('View students', route('admin.students.index'));
    }

    /**
     * @param  array{grade_level: string|null, section: string|null}  $student
     */
    private function placement(array $student): string
    {
        return collect([$student['grade_level'], $student['section']])->filter()->implode(', ') ?: '—';
    }
}
