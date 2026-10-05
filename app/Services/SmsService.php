<?php

namespace App\Services;

use App\Jobs\SendSmsJob;
use App\Models\Announcement;
use App\Models\Student;
use App\Models\User;
use App\Notifications\AnnouncementPublished;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SmsService
{
    public function send(string $recipient, string $message): bool
    {
        $response = Http::withHeaders([
            'X-API-KEY' => config('services.pinassms.key'),
            'Content-Type' => 'application/json',
        ])->post(config('services.pinassms.url'), [
            'recipient' => $this->normalize($recipient),
            'message' => $message,
        ]);

        if ($response->failed()) {
            Log::error('PinasSMS send failed', [
                'recipient' => $recipient,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }

        return $response->successful();
    }

    public function normalize(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (str_starts_with($digits, '63')) {
            return $digits;
        }

        if (str_starts_with($digits, '0')) {
            return '63'.substr($digits, 1);
        }

        return '63'.$digits;
    }

    /**
     * Text the announcement to its students, their guardians and any chosen
     * personnel, and email those personnel. The link opens the event's spot
     * on the campus map when it has one.
     */
    public function notifyForAnnouncement(Announcement $announcement): void
    {
        $students = match ($announcement->audience) {
            'targeted' => $announcement->students()->active()->with('guardians')->get(),
            'none' => collect(),
            default => Student::active()->with('guardians')->get(),
        };

        $personnel = $this->personnelFor($announcement);

        $personnel->each(fn (User $user) => $user->notify(new AnnouncementPublished($announcement)));

        $recipients = $students
            ->flatMap(fn (Student $student) => [
                $student->phone_number,
                ...$student->guardians->pluck('phone_number'),
            ])
            ->merge($personnel->pluck('phone_number'))
            ->filter()
            ->unique(fn (string $phone) => $this->normalize($phone))
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $message = $this->announcementMessage($announcement);

        foreach ($recipients as $recipient) {
            SendSmsJob::dispatch($recipient, $message);
        }
    }

    public function announcementMessage(Announcement $announcement): string
    {
        $excerpt = Str::limit(strip_tags($announcement->content), 120);
        $where = $announcement->type === 'event' ? $announcement->campusLocation?->name : null;

        return collect([
            "{$announcement->title}: {$excerpt}",
            $where !== null ? "Venue: {$where}" : null,
            $announcement->publicUrl(),
        ])->filter()->join("\n");
    }

    /**
     * @return Collection<int, User>
     */
    private function personnelFor(Announcement $announcement): Collection
    {
        $roles = $announcement->personnel_roles ?? [];

        if ($roles === []) {
            return new Collection;
        }

        // Super admins are administrators too.
        if (in_array('admin', $roles, true)) {
            $roles[] = 'super_admin';
        }

        return User::whereIn('role', $roles)->get();
    }
}
