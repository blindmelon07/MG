<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Services\SmsService;
use App\Services\StudentCredentials;
use App\Support\LoginSlips;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class StudentCredentialController extends Controller
{
    /**
     * Issue a new temporary password for one student. It is shown to the
     * registrar once and can optionally be texted to the first guardian.
     */
    public function store(Request $request, Student $student, SmsService $sms, StudentCredentials $credentials): RedirectResponse
    {
        $request->validate(['send_sms' => ['sometimes', 'boolean']]);

        if ($student->student_number === null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Add a student number first; it is the student\'s login.')]);

            return back();
        }

        $password = $student->issueTemporaryPassword();
        $this->log($request, 'issued', [$student->id]);

        $smsSent = null;

        if ($request->boolean('send_sms')) {
            $guardian = $student->guardians()->oldest('id')->first();

            $smsSent = $guardian !== null && $sms->send($guardian->phone_number, $credentials->message($student, $password));
        }

        $credentials->flash($request, $student, $password, ['sms_sent' => $smsSent]);

        return back();
    }

    /**
     * Download the printable slip (a quarter-page strip) for a password issued moments ago.
     */
    public function slip(Request $request, string $token): Response
    {
        $this->forgetExpiredSlips($request);

        $stored = $request->session()->get("credential_slips.{$token}");

        abort_if($stored === null, 404, 'This login slip has expired. Issue a new password to print another.');

        $slip = Crypt::decrypt($stored['slip']);

        return LoginSlips::download([$slip], 'login-slip-'.str($slip['student_number'])->slug().'.pdf', strip: true);
    }

    private function forgetExpiredSlips(Request $request): void
    {
        foreach ($request->session()->get('credential_slips', []) as $token => $stored) {
            if ($stored['expires_at'] < now()->getTimestamp()) {
                $request->session()->forget("credential_slips.{$token}");
            }
        }
    }

    /**
     * Issue temporary passwords for every student in a section (or the whole school)
     * who hasn't set their own password yet, and download them as a PDF of slips.
     * Students who already chose a password are left alone.
     */
    public function batch(Request $request): Response
    {
        $data = $request->validate([
            'section' => ['nullable', 'string', 'max:255'],
        ]);

        $students = Student::active()
            ->awaitingCredentials()
            ->when($data['section'] ?? null, fn ($query, $section) => $query->where('section', $section))
            ->orderBy('section')
            ->orderBy('name')
            ->get();

        $slips = DB::transaction(fn () => array_values($students
            ->map(fn (Student $student) => LoginSlips::entry($student, $student->issueTemporaryPassword()))
            ->all()));

        $this->log($request, 'batch-issued', $students->modelKeys());

        $filename = 'login-slips-'.str($data['section'] ?? 'all')->slug().'-'.now()->format('Ymd-His').'.pdf';

        return LoginSlips::download($slips, $filename);
    }

    /**
     * @param  array<int, int>  $studentIds
     */
    private function log(Request $request, string $action, array $studentIds): void
    {
        Log::info("Student credentials {$action}", [
            'user_id' => $request->user('web')?->id,
            'ip' => $request->ip(),
            'student_ids' => $studentIds,
        ]);
    }
}
