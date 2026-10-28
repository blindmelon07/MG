<?php

namespace App\Services;

use App\Jobs\SendSmsJob;
use App\Models\Student;
use App\Support\LoginSlips;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * Hands a student's portal login to them and their parents: by SMS, on
 * screen once, and as a printable slip.
 */
class StudentCredentials
{
    /** How long the printable slip for a just-issued password stays downloadable. */
    public const SLIP_MINUTES = 15;

    public function __construct(private SmsService $sms) {}

    public function message(Student $student, string $password): string
    {
        return "Aemilianum College portal login for {$student->name}: student # {$student->student_number}, temporary password {$password}. Change it after signing in.";
    }

    /**
     * The student's own number and every guardian's, without duplicates.
     *
     * @return Collection<int, string>
     */
    public function recipients(Student $student): Collection
    {
        return collect([$student->phone_number, ...$student->guardians()->pluck('phone_number')])
            ->filter()
            ->unique(fn (string $phone) => $this->sms->normalize($phone))
            ->values();
    }

    /**
     * Queue the login to the student and their guardians. Returns how many numbers it goes to.
     */
    public function text(Student $student, string $password): int
    {
        $recipients = $this->recipients($student);
        $message = $this->message($student, $password);

        foreach ($recipients as $recipient) {
            SendSmsJob::dispatch($recipient, $message);
        }

        return $recipients->count();
    }

    /**
     * Show the password to the registrar once, with a link to its printable slip.
     *
     * @param  array<string, mixed>  $extra  e.g. how the password was texted
     */
    public function flash(Request $request, Student $student, string $password, array $extra = []): void
    {
        // The slip is rendered on request, so keep it (encrypted) in the session briefly.
        $token = Str::random(40);
        $request->session()->put("credential_slips.{$token}", [
            'slip' => Crypt::encrypt(LoginSlips::entry($student, $password)),
            'expires_at' => now()->addMinutes(self::SLIP_MINUTES)->getTimestamp(),
        ]);

        Inertia::flash('credentials', [
            'name' => $student->name,
            'student_number' => $student->student_number,
            'password' => $password,
            'sms_sent' => null,
            'sms_recipients' => null,
            ...$extra,
            'slip_url' => route('admin.students.credentials.slip', $token),
        ]);
    }
}
