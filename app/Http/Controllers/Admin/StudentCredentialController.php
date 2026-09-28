<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Services\SmsService;
use App\Support\Csv;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentCredentialController extends Controller
{
    /**
     * Issue a new temporary password for one student. It is shown to the
     * registrar once and can optionally be texted to the first guardian.
     */
    public function store(Request $request, Student $student, SmsService $sms): RedirectResponse
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

            $smsSent = $guardian !== null && $sms->send(
                $guardian->phone_number,
                "Aemilianum College portal login for {$student->name}: student # {$student->student_number}, temporary password {$password}. Change it after signing in.",
            );
        }

        Inertia::flash('credentials', [
            'name' => $student->name,
            'student_number' => $student->student_number,
            'password' => $password,
            'sms_sent' => $smsSent,
        ]);

        return back();
    }

    /**
     * Issue temporary passwords for every student in a section (or the whole school)
     * who hasn't set their own password yet, and download them as printable slips.
     * Students who already chose a password are left alone.
     */
    public function batch(Request $request): StreamedResponse
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

        $rows = DB::transaction(fn () => $students->map(fn (Student $student) => [
            $student->student_number,
            $student->name,
            $student->grade_level,
            $student->section,
            $student->issueTemporaryPassword(),
        ])->all());

        $this->log($request, 'batch-issued', $students->modelKeys());

        $filename = 'student-credentials-'.str($data['section'] ?? 'all')->slug().'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                abort(500, 'Unable to open output stream.');
            }

            Csv::write($out, ['student_number', 'name', 'grade_level', 'section', 'temporary_password'], $rows);
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Cache-Control' => 'no-store, private',
        ]);
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
