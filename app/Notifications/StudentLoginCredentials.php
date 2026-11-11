<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emails a student their portal login: student number and temporary password.
 * Encrypted while queued, since the payload holds the plain password.
 */
class StudentLoginCredentials extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $password)
    {
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
        $app = config('app.name');

        return (new MailMessage)
            ->subject("Your {$app} student portal login")
            ->greeting("Hi {$notifiable->name},")
            ->line('An account was created for you on the student portal, where you can check your grades.')
            ->line("**Student number:** {$notifiable->student_number}")
            ->line("**Temporary password:** {$this->password}")
            ->line('You will be asked to choose your own password the first time you sign in.')
            ->action('Sign in to the student portal', route('student.login'))
            ->line('Keep this email private. If you did not expect it, tell the school registrar.');
    }
}
