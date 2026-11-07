<?php

namespace App\Notifications;

use App\Support\LoginAttempt;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emails a staff member about a sign-in, or a failed one, on their account.
 */
class LoginAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public LoginAttempt $attempt)
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
        $attempt = $this->attempt;
        $app = config('app.name');

        $message = match ($attempt->outcome) {
            LoginAttempt::SUCCEEDED => (new MailMessage)
                ->subject("New sign-in to your {$app} account")
                ->line('Your account was just signed in to.'),
            LoginAttempt::TWO_FACTOR_FAILED => (new MailMessage)
                ->error()
                ->subject("Someone entered your {$app} password")
                ->line('Someone entered your correct password but a wrong two-factor authentication code.')
                ->line('**If this wasn\'t you, change your password right away.**'),
            default => (new MailMessage)
                ->error()
                ->subject("Failed sign-in attempt on your {$app} account")
                ->line('Someone tried to sign in to your account with a wrong password.'),
        };

        return $message
            ->line("**When:** {$attempt->time()}")
            ->line("**Device:** {$attempt->device}")
            ->line('**IP address:** '.($attempt->ip ?? 'unknown'))
            ->line($attempt->outcome === LoginAttempt::SUCCEEDED
                ? 'If this was you, you can ignore this email. If not, change your password now and tell the school administrator.'
                : 'If this keeps happening, tell the school administrator.')
            ->action('Review account security', route('security.edit'));
    }
}
