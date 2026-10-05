<?php

namespace App\Notifications;

use App\Models\Announcement;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Emails school personnel about an announcement or event. For an event with
 * an area on the campus map, the button opens the map at that spot.
 */
class AnnouncementPublished extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Announcement $announcement) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $announcement = $this->announcement;
        $isEvent = $announcement->type === 'event';

        $message = (new MailMessage)
            ->subject(($isEvent ? 'Event: ' : 'Announcement: ').$announcement->title)
            ->greeting($announcement->title);

        if ($isEvent && $announcement->event_start_at !== null) {
            $when = $announcement->event_start_at->format('l, F j, Y g:i A');

            if ($announcement->event_end_at !== null) {
                $when .= ' – '.$announcement->event_end_at->format(
                    $announcement->event_end_at->isSameDay($announcement->event_start_at) ? 'g:i A' : 'F j, Y g:i A',
                );
            }

            $message->line("**When:** {$when}");
        }

        $where = collect([$announcement->campusLocation?->name, $announcement->location])->filter()->join(' — ');

        if ($isEvent && $where !== '') {
            $message->line("**Where:** {$where}");
        }

        return $message
            ->line(Str::limit(strip_tags($announcement->content), 500))
            ->action(
                $isEvent && $announcement->campus_location_id !== null ? 'Show on campus map' : 'Read announcement',
                $announcement->publicUrl(),
            );
    }
}
