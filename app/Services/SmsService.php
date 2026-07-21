<?php

namespace App\Services;

use App\Jobs\SendSmsJob;
use App\Models\Announcement;
use App\Models\Student;
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

    public function notifyForAnnouncement(Announcement $announcement): void
    {
        $students = $announcement->audience === 'targeted'
            ? $announcement->students()->active()->with('guardians')->get()
            : Student::active()->with('guardians')->get();

        $recipients = $students
            ->flatMap(fn (Student $student) => [
                $student->phone_number,
                ...$student->guardians->pluck('phone_number'),
            ])
            ->filter()
            ->unique()
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $excerpt = Str::limit(strip_tags($announcement->content), 120);
        $message = "{$announcement->title}: {$excerpt}";

        foreach ($recipients as $recipient) {
            SendSmsJob::dispatch($recipient, $message);
        }
    }
}
