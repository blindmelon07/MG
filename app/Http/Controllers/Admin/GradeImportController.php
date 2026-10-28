<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Support\Csv;
use App\Support\Spreadsheet;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Spreadsheet as Workbook;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class GradeImportController extends Controller
{
    private const HEADERS = [
        'k12' => ['student_number', 'student_name', 'year_level', 'section', 'school_year', 'subject', 'term_1', 'term_2', 'term_3', 'final_grade', 'remarks'],
        'college' => ['student_number', 'student_name', 'year_level', 'section', 'school_year', 'term', 'subject_code', 'subject', 'units', 'midterm', 'final_grade', 'remarks'],
    ];

    /** Older templates named the K-12 terms q1 to q3; read those too. */
    private const HEADER_ALIASES = ['q1' => 'term_1', 'q2' => 'term_2', 'q3' => 'term_3'];

    /** Non-numeric values accepted in the final_grade column, stored as remarks. */
    private const SPECIAL_REMARKS = ['INC', 'DRP', 'W', 'NG', 'OD', 'UD'];

    /** @var array<string, Student|null> */
    private array $students = [];

    /**
     * An Excel template listing the enrolled students to grade: a teacher's
     * class, or (for staff) any year level, section or course. With no class
     * chosen it holds one sample row.
     */
    public function template(Request $request, string $system): StreamedResponse
    {
        $user = $request->user('web');

        $filters = $request->validate([
            'assignment' => ['nullable', 'integer'],
            'school_year' => ['nullable', 'string', 'max:9'],
            'education_level' => ['nullable', Rule::in($this->levelsFor($system))],
            'grade_level' => ['nullable', 'string', 'max:255'],
            'course_id' => ['nullable', 'integer'],
            'section' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
        ]);

        $assignment = null;

        if (! empty($filters['assignment'])) {
            $assignment = TeachingAssignment::findOrFail($filters['assignment']);
            abort_unless($user->canManageAllGrades() || $assignment->user_id === $user->id, 403);
        } elseif (! $user->canManageAllGrades() && count(array_filter($filters)) > 0) {
            abort(403, 'Download the class list of one of your teaching assignments.');
        }

        $filtered = $assignment !== null || count(array_filter($filters)) > 0;
        $year = $assignment->school_year ?? $filters['school_year'] ?? SchoolYear::selected();
        $subject = $assignment->subject ?? $filters['subject'] ?? null;

        $rows = $filtered
            ? $this->classList($system, $year, $assignment, $filters)
                ->map(fn (Student $student) => $this->blankRow($system, $student, $year, $subject))
                ->all()
            : [$this->sampleRow($system)];

        $name = $assignment !== null
            ? "{$assignment->subject} {$assignment->section} {$year}"
            : collect([$filters['grade_level'] ?? null, $filters['section'] ?? null, $subject, $filtered ? $year : 'template'])->filter()->join(' ');

        return Spreadsheet::download($this->workbook($system, $rows), 'grades-'.$system.'-'.str($name)->slug().'.xlsx');
    }

    /**
     * Active students enrolled in the class, A to Z.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, Student>
     */
    private function classList(string $system, string $year, ?TeachingAssignment $assignment, array $filters): Collection
    {
        return Student::active()
            ->whereNotNull('student_number')
            ->with(['enrollments' => fn ($query) => $query->where('school_year', $year)])
            ->when(
                $assignment !== null,
                fn (Builder $query) => $query->inSectionDuring($assignment->section, $year),
                fn (Builder $query) => $query->whereHas('enrollments', fn (Builder $q) => $q
                    ->where('school_year', $year)
                    ->whereIn('education_level', isset($filters['education_level']) ? [$filters['education_level']] : $this->levelsFor($system))
                    ->when($filters['grade_level'] ?? null, fn (Builder $q, string $grade) => $q->where('grade_level', $grade))
                    ->when($filters['course_id'] ?? null, fn (Builder $q, int|string $course) => $q->where('course_id', $course))
                    ->when($filters['section'] ?? null, fn (Builder $q, string $section) => $q->where('section', $section))),
            )
            ->orderBy('name')
            ->get()
            // A class-list template only has rows for students on this grading system.
            ->filter(fn (Student $student) => ($student->enrollments->first()?->gradingSystem() ?? $student->grading_system) === $system)
            ->values();
    }

    /**
     * @param  list<list<string|null>>  $rows
     */
    private function workbook(string $system, array $rows): Workbook
    {
        $headers = self::HEADERS[$system];
        $workbook = new Workbook;
        $sheet = $workbook->getActiveSheet();
        $sheet->setTitle('Grades');

        $sheet->fromArray([$headers, ...array_map(fn (array $row) => Csv::safeRow($row), $rows)], null, 'A1', true);
        $sheet->getStyle('A1:'.Spreadsheet::column(count($headers)).'1')->getFont()->setBold(true);
        $sheet->freezePane('C2');

        foreach (range(1, count($headers)) as $index) {
            $sheet->getColumnDimension(Spreadsheet::column($index))->setAutoSize(true);
        }

        // Text, so student numbers such as 2026-00123 aren't turned into dates or numbers.
        $sheet->getStyle('A2:A'.(count($rows) + 1))->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);

        if ($system === 'college') {
            $term = Spreadsheet::column(array_search('term', $headers, true) + 1);
            Spreadsheet::addDropdown($sheet, "{$term}2:{$term}".max(count($rows) + 1, 2), '"'.implode(',', Grade::TERMS).'"', 'Pick the semester.', allowBlank: true);
        }

        return $workbook;
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'grading_system' => ['required', Rule::in(Student::GRADING_SYSTEMS)],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
        ]);

        $user = $request->user('web');
        $system = $request->string('grading_system')->toString();
        $assignments = $user->canManageAllGrades() ? null : $user->teachingAssignments()->get();

        try {
            $rows = Spreadsheet::rows($request->file('file')->getRealPath(), $request->file('file')->getClientOriginalExtension());
        } catch (Throwable) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('The file could not be read. Use the Excel template or a CSV file.')]);

            return back();
        }

        $header = array_map(fn (string $column) => self::HEADER_ALIASES[$column] ?? $column, Spreadsheet::header(array_shift($rows) ?? []));

        if (! in_array('student_number', $header, true) || ! in_array('subject', $header, true)) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('The file is missing the student_number or subject column. Download the template to see the expected format.')]);

            return back();
        }

        $created = 0;
        $updated = 0;
        $errors = [];
        $rowNumber = 1;

        foreach ($rows as $row) {
            $rowNumber++;

            if (Spreadsheet::isBlank($row)) {
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

        $schoolYear = $this->clean($data['school_year'] ?? null);

        if (! SchoolYear::isValidName($schoolYear)) {
            return $this->error('School year must look like 2026-2027.');
        }

        $studentSystem = $student->gradingSystemIn($schoolYear);

        if ($studentSystem !== $system) {
            $label = $studentSystem === 'college' ? 'college' : 'K-12';

            return $this->error("{$student->name} is a {$label} student; use the {$label} template.");
        }

        $subject = $this->clean($data['subject'] ?? null);

        if ($subject === null) {
            return $this->error('Missing subject.');
        }

        $section = $student->sectionIn($schoolYear);

        if ($assignments !== null && ! $assignments->contains(fn (TeachingAssignment $a) => $a->covers($subject, $section, $schoolYear))) {
            $section ??= 'no section';

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

        SchoolYear::firstOrCreate(['name' => $schoolYear]);

        return ['status' => $grade->wasRecentlyCreated ? 'created' : 'updated', 'message' => null];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|string the grade columns, or an error message
     */
    private function k12Values(array $data): array|string
    {
        $values = ['term' => null];

        foreach (Grade::K12_TERMS as $index => $column) {
            $number = $index + 1;
            $value = $this->number($data["term_{$number}"] ?? null, 0, 100);

            if ($value === false) {
                return "Term {$number} must be a number from 0 to 100.";
            }

            $values[$column] = $value;
        }

        [$final, $remarks] = $this->finalAndRemarks($data, 0, 100);

        if ($final === false) {
            return 'Final grade must be a number from 0 to 100.';
        }

        $final ??= Grade::k12Final(array_values(array_intersect_key($values, array_flip(Grade::K12_TERMS))));

        return [
            ...$values,
            // Left over from four-quarter grading; cleared so the final matches the three terms.
            'q4' => null,
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

    private function findStudent(string $studentNumber): ?Student
    {
        return $this->students[$studentNumber] ??= Student::with('enrollments')->where('student_number', $studentNumber)->first();
    }

    /**
     * @return list<string>
     */
    private function levelsFor(string $system): array
    {
        return array_keys(array_filter(Student::EDUCATION_LEVELS, fn (array $level) => $level['grading_system'] === $system));
    }

    /**
     * @return list<string>
     */
    private function sampleRow(string $system): array
    {
        return $system === 'college'
            ? ['2026-00123', 'Juan Dela Cruz', '1st Year', 'BSIT 1-A', '2026-2027', '1st Semester', 'IT 101', 'Introduction to Computing', '3', '1.75', '1.50', '']
            : ['LRN-00012345', 'Juan Dela Cruz', 'Grade 8', 'St. Thomas', '2026-2027', 'Mathematics', '85', '87', '88', '', ''];
    }

    /**
     * @return list<string|null>
     */
    private function blankRow(string $system, Student $student, string $year, ?string $subject): array
    {
        $enrollment = $student->enrollments->first();
        $gradeLevel = $enrollment->grade_level ?? $student->grade_level;
        $section = $enrollment !== null ? $enrollment->section : $student->section;

        if ($system === 'k12') {
            return [$student->student_number, $student->name, $gradeLevel, $section, $year, $subject, null, null, null, null, null];
        }

        $course = $enrollment?->course_id !== null ? Course::find($enrollment->course_id)?->code : null;
        // Fill the code and units from the Subjects list when the subject is on it.
        $listed = $subject === null ? null : Subject::where('name', $subject)->whereIn('education_level', $this->levelsFor('college'))->first();

        return [
            $student->student_number,
            $student->name,
            collect([$course, $gradeLevel])->filter()->join(' '),
            $section,
            $year,
            null,
            $listed?->code,
            $subject,
            $listed?->units !== null ? (string) (float) $listed->units : null,
            null,
            null,
            null,
        ];
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
