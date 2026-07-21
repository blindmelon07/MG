<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Rules\PhilippineMobileNumber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentImportController extends Controller
{
    private const GUARDIAN_SLOTS = 2;

    public function template(): StreamedResponse
    {
        $headers = ['name', 'student_number', 'grade_level', 'section', 'status', 'phone_number'];

        for ($i = 1; $i <= self::GUARDIAN_SLOTS; $i++) {
            $headers[] = "guardian_{$i}_name";
            $headers[] = "guardian_{$i}_relationship";
            $headers[] = "guardian_{$i}_phone";
        }

        $sample = [
            'Juan Dela Cruz', 'LRN-00012345', 'Grade 8', 'St. Thomas', 'active', '',
            'Maria Dela Cruz', 'Mother', '09171234567',
            'Jose Dela Cruz', 'Father', '09181234567',
        ];

        return response()->streamDownload(function () use ($headers, $sample) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                abort(500, 'Unable to open output stream.');
            }

            fputcsv($out, $headers);
            fputcsv($out, $sample);
            fclose($out);
        }, 'students-import-template.csv', ['Content-Type' => 'text/csv']);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');

        if ($handle === false) {
            abort(422, 'Unable to read the uploaded file.');
        }

        $header = array_map(fn ($column) => strtolower(trim((string) $column)), fgetcsv($handle) ?: []);

        $created = 0;
        $skipped = 0;
        $errors = [];
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (count(array_filter($row, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $data = array_combine($header, array_pad($row, count($header), null));
            $result = $this->importRow($data);

            match ($result['status']) {
                'created' => $created++,
                'skipped' => $skipped++,
                'error' => $errors[] = "Row {$rowNumber}: {$result['message']}",
            };
        }

        fclose($handle);

        Inertia::flash('toast', [
            'type' => $errors === [] ? 'success' : ($created > 0 ? 'warning' : 'error'),
            'message' => $this->summarize($created, $skipped, $errors),
        ]);

        return to_route('admin.students.index');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{status: 'created'|'skipped'|'error', message: string|null}
     */
    private function importRow(array $data): array
    {
        $name = $this->clean($data['name'] ?? null);

        if ($name === null) {
            return ['status' => 'error', 'message' => 'Missing name.'];
        }

        $studentNumber = $this->clean($data['student_number'] ?? null);

        if ($studentNumber !== null && Student::where('student_number', $studentNumber)->exists()) {
            return ['status' => 'skipped', 'message' => null];
        }

        $guardians = [];

        for ($i = 1; $i <= self::GUARDIAN_SLOTS; $i++) {
            $guardianName = $this->clean($data["guardian_{$i}_name"] ?? null);

            if ($guardianName === null) {
                continue;
            }

            $phone = $this->clean($data["guardian_{$i}_phone"] ?? null);

            if ($phone === null || ! preg_match(PhilippineMobileNumber::PATTERN, $phone)) {
                return ['status' => 'error', 'message' => "Invalid or missing phone for guardian \"{$guardianName}\"."];
            }

            $guardians[] = [
                'name' => $guardianName,
                'relationship' => $this->clean($data["guardian_{$i}_relationship"] ?? null) ?? 'Guardian',
                'phone_number' => $phone,
            ];
        }

        if ($guardians === []) {
            return ['status' => 'error', 'message' => 'At least one guardian is required.'];
        }

        $phoneNumber = $this->clean($data['phone_number'] ?? null);

        if ($phoneNumber !== null && ! preg_match(PhilippineMobileNumber::PATTERN, $phoneNumber)) {
            return ['status' => 'error', 'message' => 'Invalid student phone number.'];
        }

        $status = strtolower($this->clean($data['status'] ?? null) ?? 'active');

        if (! in_array($status, ['active', 'inactive'], true)) {
            $status = 'active';
        }

        DB::transaction(function () use ($name, $studentNumber, $data, $status, $phoneNumber, $guardians): void {
            $student = Student::create([
                'name' => $name,
                'student_number' => $studentNumber,
                'grade_level' => $this->clean($data['grade_level'] ?? null),
                'section' => $this->clean($data['section'] ?? null),
                'phone_number' => $phoneNumber,
                'status' => $status,
            ]);

            $student->guardians()->createMany($guardians);
        });

        return ['status' => 'created', 'message' => null];
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /**
     * @param  list<string>  $errors
     */
    private function summarize(int $created, int $skipped, array $errors): string
    {
        $parts = ["Imported {$created} student(s)."];

        if ($skipped > 0) {
            $parts[] = "{$skipped} skipped (duplicate student #).";
        }

        if ($errors !== []) {
            $shown = array_slice($errors, 0, 3);
            $parts[] = count($errors).' row(s) had errors: '.implode('; ', $shown);

            if (count($errors) > count($shown)) {
                $parts[] = '(+'.(count($errors) - count($shown)).' more)';
            }
        }

        return implode(' ', $parts);
    }
}
