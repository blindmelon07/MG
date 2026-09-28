<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Grade;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Support\Csv;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GradeImportController extends Controller
{
    private const HEADERS = [
        'k12' => ['student_number', 'student_name', 'school_year', 'subject', 'q1', 'q2', 'q3', 'q4', 'final_grade', 'remarks'],
        'college' => ['student_number', 'student_name', 'school_year', 'term', 'subject_code', 'subject', 'units', 'midterm', 'final_grade', 'remarks'],
    ];

    /** Non-numeric values accepted in the final_grade column, stored as remarks. */
    private const SPECIAL_REMARKS = ['INC', 'DRP', 'W', 'NG', 'OD', 'UD'];

    /** @var array<string, Student|null> */
    private array $students = [];

    /**
     * Download a blank template, or one pre-filled with the class list of a teaching assignment.
     */
    public function template(Request $request, string $system): StreamedResponse
    {
        $user = $request->user('web');

        $rows = [$this->sampleRow($system)];
        $filename = "grades-{$system}-template.csv";

        if ($request->filled('assignment')) {
            $assignment = TeachingAssignment::findOrFail($request->integer('assignment'));
            abort_unless($user->canManageAllGrades() || $assignment->user_id === $user->id, 403);

            $rows = Student::active()
                ->where('section', $assignment->section)
                ->where('grading_system', $system)
                ->whereNotNull('student_number')
                ->orderBy('name')
                ->get()
                ->map(fn (Student $student) => $this->blankRow($system, $student, $assignment))
                ->all();

            $filename = 'grades-'.str($assignment->subject.' '.$assignment->section.' '.$assignment->school_year)->slug().'.csv';
        }

        return response()->streamDownload(function () use ($system, $rows) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                abort(500, 'Unable to open output stream.');
            }

            Csv::write($out, self::HEADERS[$system], $rows);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'grading_system' => ['required', Rule::in(Student::GRADING_SYSTEMS)],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $user = $request->user('web');
        $system = $request->string('grading_system')->toString();
        $assignments = $user->canManageAllGrades() ? null : $user->teachingAssignments()->get();

        $handle = fopen($request->file('file')->getRealPath(), 'r');

        if ($handle === false) {
            abort(422, 'Unable to read the uploaded file.');
        }

        $header = array_map(fn ($column) => strtolower(trim((string) $column, " \t\n\r\0\x0B\u{FEFF}")), fgetcsv($handle) ?: []);

        if (! in_array('student_number', $header, true) || ! in_array('subject', $header, true)) {
            fclose($handle);

            Inertia::flash('toast', ['type' => 'error', 'message' => __('The file is missing the student_number or subject column. Download the template to see the expected format.')]);

            return back();
        }

        $created = 0;
        $updated = 0;
        $errors = [];
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (count(array_filter($row, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $data = array_combine($header, array_slice(array_pad($row, count($header), null), 0, count($header)));
            $result = $this->importRow($data, $system, $user, $assignments);

            match ($result['status']) {
                'created' => $created++,
                'updated' => $updated++,
                'error' => $errors[] = "Row {$rowNumber}: {$result['message']}",
            };
        }

        fclose($handle);

        Inertia::flash('toast', [
            'type' => $errors === [] ? 'success' : ($created + $updated > 0 ? 'warning' : 'error'),
            'message' => $this->summarize($created, $updated, $errors),
        ]);

        return to_route('admin.grades.index');
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  Collection<int, TeachingAssignment>|null  $assignments  null when the user may import for anyone
     * @return array{status: 'created'|'updated'|'error', message: string|null}
     */
    private function importRow(array $data, string $system, User $user, ?Collection $assignments): array
    {
        $studentNumber = $this->clean($data['student_number'] ?? null);

        if ($studentNumber === null) {
            return $this->error('Missing student number.');
        }

        $student = $this->findStudent($studentNumber);

        if ($student === null) {
            return $this->error("Student # {$studentNumber} not found.");
        }

        if ($student->grading_system !== $system) {
            $label = $student->grading_system === 'college' ? 'college' : 'K-12';

            return $this->error("{$student->name} is a {$label} student; use the {$label} template.");
        }

        $schoolYear = $this->clean($data['school_year'] ?? null);

        if (! $this->isValidSchoolYear($schoolYear)) {
            return $this->error('School year must look like 2026-2027.');
        }

        $subject = $this->clean($data['subject'] ?? null);

        if ($subject === null) {
            return $this->error('Missing subject.');
        }

        if ($assignments !== null && ! $assignments->contains(fn (TeachingAssignment $a) => $a->covers($subject, $student->section, $schoolYear))) {
            $section = $student->section ?? 'no section';

            return $this->error("You are not assigned to {$subject} for {$section} ({$schoolYear}).");
        }

        $values = $system === 'college'
            ? $this->collegeValues($data)
            : $this->k12Values($data);

        if (is_string($values)) {
            return $this->error($values);
        }

        $term = $values['term'];
        unset($values['term']);

        $grade = Grade::updateOrCreate(
            [
                'student_id' => $student->id,
                'school_year' => $schoolYear,
                'term' => $term,
                'subject' => $subject,
            ],
            [
                ...$values,
                'grading_system' => $system,
                'encoded_by' => $user->id,
            ],
        );

        return ['status' => $grade->wasRecentlyCreated ? 'created' : 'updated', 'message' => null];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|string the grade columns, or an error message
     */
    private function k12Values(array $data): array|string
    {
        $values = ['term' => null];

        foreach (['q1', 'q2', 'q3', 'q4'] as $quarter) {
            $value = $this->number($data[$quarter] ?? null, 0, 100);

            if ($value === false) {
                return strtoupper($quarter).' must be a number from 0 to 100.';
            }

            $values[$quarter] = $value;
        }

        [$final, $remarks] = $this->finalAndRemarks($data, 0, 100);

        if ($final === false) {
            return 'Final grade must be a number from 0 to 100.';
        }

        $final ??= Grade::k12Final([$values['q1'], $values['q2'], $values['q3'], $values['q4']]);

        return [
            ...$values,
            'final_grade' => $final,
            'remarks' => $remarks ?? Grade::remarksFor('k12', $final),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|string the grade columns, or an error message
     */
    private function collegeValues(array $data): array|string
    {
        $term = $this->normalizeTerm($this->clean($data['term'] ?? null));

        if ($term === null) {
            return 'Term must be 1st Semester, 2nd Semester, or Summer.';
        }

        $units = $this->number($data['units'] ?? null, 0, 12);

        if ($units === false) {
            return 'Units must be a number from 0 to 12.';
        }

        $midterm = $this->number($data['midterm'] ?? null, 1, 5);

        if ($midterm === false) {
            return 'Midterm must be on the 1.00 to 5.00 scale.';
        }

        [$final, $remarks] = $this->finalAndRemarks($data, 1, 5);

        if ($final === false) {
            return 'Final grade must be on the 1.00 to 5.00 scale, or INC/DRP.';
        }

        return [
            'term' => $term,
            'subject_code' => $this->clean($data['subject_code'] ?? null),
            'units' => $units,
            'midterm' => $midterm,
            'final_grade' => $final,
            'remarks' => $remarks ?? Grade::remarksFor('college', $final),
        ];
    }

    /**
     * Reads final_grade and remarks, letting final_grade hold a special mark such as INC.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: float|null|false, 1: string|null}
     */
    private function finalAndRemarks(array $data, float $min, float $max): array
    {
        $remarks = $this->clean($data['remarks'] ?? null);
        $raw = $this->clean($data['final_grade'] ?? null);

        if ($raw !== null && in_array(strtoupper($raw), self::SPECIAL_REMARKS, true)) {
            return [null, $remarks ?? strtoupper($raw)];
        }

        return [$this->number($raw, $min, $max), $remarks];
    }

    /**
     * @return float|null|false null when blank, false when invalid
     */
    private function number(mixed $value, float $min, float $max): float|null|false
    {
        $value = $this->clean($value);

        if ($value === null) {
            return null;
        }

        if (! is_numeric($value) || (float) $value < $min || (float) $value > $max) {
            return false;
        }

        return (float) $value;
    }

    private function normalizeTerm(?string $term): ?string
    {
        $term = strtolower((string) $term);

        return match (true) {
            $term === '' => null,
            str_contains($term, 'sum') => 'Summer',
            str_starts_with($term, '1') || str_contains($term, 'first') => '1st Semester',
            str_starts_with($term, '2') || str_contains($term, 'second') => '2nd Semester',
            default => null,
        };
    }

    private function isValidSchoolYear(?string $schoolYear): bool
    {
        if ($schoolYear === null || ! preg_match('/^(\d{4})-(\d{4})$/', $schoolYear, $matches)) {
            return false;
        }

        return (int) $matches[2] === (int) $matches[1] + 1;
    }

    private function findStudent(string $studentNumber): ?Student
    {
        return $this->students[$studentNumber] ??= Student::where('student_number', $studentNumber)->first();
    }

    /**
     * @return list<string>
     */
    private function sampleRow(string $system): array
    {
        return $system === 'college'
            ? ['2026-00123', 'Juan Dela Cruz', '2026-2027', '1st Semester', 'IT 101', 'Introduction to Computing', '3', '1.75', '1.50', '']
            : ['LRN-00012345', 'Juan Dela Cruz', '2026-2027', 'Mathematics', '85', '87', '88', '90', '', ''];
    }

    /**
     * @return list<string|null>
     */
    private function blankRow(string $system, Student $student, TeachingAssignment $assignment): array
    {
        return $system === 'college'
            ? [$student->student_number, $student->name, $assignment->school_year, '', '', $assignment->subject, '', '', '', '']
            : [$student->student_number, $student->name, $assignment->school_year, $assignment->subject, '', '', '', '', '', ''];
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /**
     * @return array{status: 'error', message: string}
     */
    private function error(string $message): array
    {
        return ['status' => 'error', 'message' => $message];
    }

    /**
     * @param  list<string>  $errors
     */
    private function summarize(int $created, int $updated, array $errors): string
    {
        $parts = ["Imported {$created} new grade(s)."];

        if ($updated > 0) {
            $parts[] = "{$updated} existing grade(s) updated.";
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
