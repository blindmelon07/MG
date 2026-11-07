<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells a teacher the registrar sent some of their college grades back
 * instead of posting them, and why.
 */
class GradesReturned extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  list<string>  $subjects  the subjects of the returned grades
     */
    public function __construct(
        public int $count,
        public array $subjects,
        public string $reason,
        public string $registrarName,
    ) {
        $this->onConnection(config('queue.notifications'));
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
        $grades = $this->count === 1 ? '1 grade' : "{$this->count} grades";

        return (new MailMessage)
            ->subject("Grades returned by the Registrar: {$grades} need your attention")
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line("{$this->registrarName} returned {$grades} you uploaded instead of posting them to students.")
            ->line('**Subjects:** '.implode(', ', $this->subjects))
            ->line("**Reason:** {$this->reason}")
            ->line('Correct the grades and upload them again. They will go back to the Registrar for approval.')
            ->action('See returned grades', route('admin.grades.index', ['status' => 'returned', 'school_year' => 'all']));
    }
}
