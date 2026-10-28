<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Rules\PhilippineMobileNumber;
use App\Services\StudentCredentials;
use App\Support\Spreadsheet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\NamedRange;
use PhpOffice\PhpSpreadsheet\Spreadsheet as Workbook;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class StudentImportController extends Controller
{
    private const GUARDIAN_SLOTS = 2;

    /** Rows of the template that get dropdowns and text-formatted phone cells. */
    private const TEMPLATE_ROWS = 1000;

    /**
     * @return list<string>
     */
    private function headers(): array
    {
        $headers = ['name', 'student_number', 'education_level', 'grade_level', 'course', 'section', 'status', 'phone_number'];

        for ($i = 1; $i <= self::GUARDIAN_SLOTS; $i++) {
            $headers[] = "guardian_{$i}_name";
            $headers[] = "guardian_{$i}_relationship";
            $headers[] = "guardian_{$i}_phone";
        }

        return $headers;
    }

    /**
     * An Excel workbook with dropdowns: the year level list follows the
     * education level picked in the same row.
     */
    public function template(): StreamedResponse
    {
        $headers = $this->headers();
        $spreadsheet = new Workbook;

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Students');
        $sheet->fromArray([$headers, [
            'Juan Dela Cruz', 'LRN-00012345', 'Junior High School', 'Grade 8', '', 'St. Thomas', 'active', '',
            'Maria Dela Cruz', 'Mother', '09171234567',
            'Jose Dela Cruz', 'Father', '09181234567',
        ]], null, 'A1', true);
        $sheet->getStyle('A1:'.Spreadsheet::column(count($headers)).'1')->getFont()->setBold(true);
        $sheet->freezePane('A2');

        foreach (range(1, count($headers)) as $index) {
            $sheet->getColumnDimension(Spreadsheet::column($index))->setAutoSize(true);
        }

        $this->addLists($spreadsheet);

        $lastRow = self::TEMPLATE_ROWS + 1;
        $column = fn (string $header) => Spreadsheet::column(array_search($header, $headers, true) + 1);
        $levelColumn = $column('education_level');

        Spreadsheet::addDropdown($sheet, "{$levelColumn}2:{$levelColumn}{$lastRow}", 'EducationLevels', 'Pick an education level.');
        // INDIRECT turns "Junior High School" into the named range Junior_High_School.
        Spreadsheet::addDropdown($sheet, "{$column('grade_level')}2:{$column('grade_level')}{$lastRow}", "INDIRECT(SUBSTITUTE({$levelColumn}2,\" \",\"_\"))", 'Pick the education level first, then a year level.');
        Spreadsheet::addDropdown($sheet, "{$column('status')}2:{$column('status')}{$lastRow}", '"active,inactive"', 'active or inactive.');

        if (Course::exists()) {
            Spreadsheet::addDropdown($sheet, "{$column('course')}2:{$column('course')}{$lastRow}", 'Courses', 'College and graduate school only: pick the course.', allowBlank: true);
        }

        // Stored as text so Excel keeps the leading 0 of 09XXXXXXXXX.
        foreach ($headers as $index => $header) {
            if (str_ends_with($header, 'phone') || $header === 'phone_number' || $header === 'student_number') {
                $letter = Spreadsheet::column($index + 1);
                $sheet->getStyle("{$letter}2:{$letter}{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
            }
        }

        return Spreadsheet::download($spreadsheet, 'students-import-template.xlsx');
    }

    /**
     * A "Lists" sheet holding the dropdown values: one named range per
     * education level, the courses, and a reference list of sections.
     */
    private function addLists(Workbook $spreadsheet): void
    {
        $lists = $spreadsheet->createSheet();
        $lists->setTitle('Lists');

        $levels = array_values(Student::EDUCATION_LEVELS);

        foreach ($levels as $index => $level) {
            $column = Spreadsheet::column($index + 1);
            $lists->setCellValue("{$column}1", $level['label']);
            $lists->fromArray(array_map(fn ($grade) => [$grade], $level['grade_levels']), null, "{$column}2");

            $last = count($level['grade_levels']) + 1;
            $spreadsheet->addNamedRange(new NamedRange(str_replace(' ', '_', $level['label']), $lists, "\${$column}\$2:\${$column}\${$last}"));
        }

        $spreadsheet->addNamedRange(new NamedRange('EducationLevels', $lists, '$A$1:$'.Spreadsheet::column(count($levels)).'$1'));

        $courses = Course::orderBy('code')->pluck('code');

        if ($courses->isNotEmpty()) {
            $column = Spreadsheet::column(count($levels) + 2);
            $lists->setCellValue("{$column}1", 'Courses');
            $lists->fromArray($courses->map(fn ($code) => [$code])->all(), null, "{$column}2");
            $spreadsheet->addNamedRange(new NamedRange('Courses', $lists, "\${$column}\$2:\${$column}\$".($courses->count() + 1)));
        }

        $lists->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

        $this->addSectionsSheet($spreadsheet);
    }

    /**
     * A visible sheet listing every section by year level, for reference while filling in the template.
     */
    private function addSectionsSheet(Workbook $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Sections');

        $rows = Section::with('course:id,code')->orderBy('education_level')->orderBy('grade_level')->orderBy('name')->get()
            ->map(fn (Section $section) => [
                Student::EDUCATION_LEVELS[$section->education_level]['label'] ?? $section->education_level,
                $section->grade_level,
                $section->course?->code,
                $section->name,
            ])
            ->all();

        $sheet->fromArray([['education_level', 'grade_level', 'course', 'section'], ...$rows], null, 'A1', true);
        $sheet->getStyle('A1:D1')->getFont()->setBold(true);

        foreach (range(1, 4) as $index) {
            $sheet->getColumnDimension(Spreadsheet::column($index))->setAutoSize(true);
        }
    }

    public function store(Request $request, StudentCredentials $credentials): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
            'send_credentials' => ['sometimes', 'boolean'],
        ]);

        try {
            $rows = Spreadsheet::rows($request->file('file')->getRealPath(), $request->file('file')->getClientOriginalExtension());
        } catch (Throwable) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('The file could not be read. Use the Excel template or a CSV file.')]);

            return to_route('admin.students.index');
        }

        $header = Spreadsheet::header(array_shift($rows) ?? []);
        $year = SchoolYear::selected();
        $sendCredentials = $request->boolean('send_credentials');

        $counts = ['created' => 0, 'enrolled' => 0, 'unchanged' => 0, 'texted' => 0];
        $errors = [];
        $issuedTo = [];
        $rowNumber = 1;

        foreach ($rows as $row) {
            $rowNumber++;

            if (Spreadsheet::isBlank($row)) {
                continue;
            }

            $data = array_combine($header, array_slice(array_pad($row, count($header), null), 0, count($header)));
            $result = $this->importRow($data, $year);

            if ($result['status'] === 'error') {
                $errors[] = "Row {$rowNumber}: {$result['message']}";

                continue;
            }

            $counts[$result['status']]++;

            if ($result['status'] === 'created' && $sendCredentials) {
                $counts['texted'] += $credentials->text($result['student'], $result['student']->issueTemporaryPassword());
                $issuedTo[] = $result['student']->id;
            }
        }

        if ($issuedTo !== []) {
            Log::info('Student credentials issued on import', [
                'user_id' => $request->user('web')?->id,
                'ip' => $request->ip(),
                'student_ids' => $issuedTo,
            ]);
        }

        Inertia::flash('toast', [
            'type' => $errors === [] ? 'success' : ($counts['created'] + $counts['enrolled'] > 0 ? 'warning' : 'error'),
            'message' => $this->summarize($counts, $year, $errors),
        ]);

        return to_route('admin.students.index');
    }

    /**
     * A new student number adds the student; one already on file records
     * where that student is in the school year being imported.
     *
     * @param  array<string, mixed>  $data
     * @return array{status: 'created'|'enrolled'|'unchanged', student: Student}|array{status: 'error', message: string}
     */
    private function importRow(array $data, string $year): array
    {
        $studentNumber = $this->clean($data['student_number'] ?? null);

        if ($studentNumber === null) {
            return $this->error('Missing student number.');
        }

        $placement = $this->placement($data);

        if (is_string($placement)) {
            return $this->error($placement);
        }

        $existing = Student::where('student_number', $studentNumber)->first();

        if ($existing !== null) {
            $current = $existing->enrollmentFor($year)?->only(array_keys($placement));

            if ($current == $placement) {
                return ['status' => 'unchanged', 'student' => $existing];
            }

            $existing->enroll($year, $placement);

            return ['status' => 'enrolled', 'student' => $existing];
        }

        $name = $this->clean($data['name'] ?? null);

        if ($name === null) {
            return $this->error('Missing name.');
        }

        $guardians = [];

        for ($i = 1; $i <= self::GUARDIAN_SLOTS; $i++) {
            $guardianName = $this->clean($data["guardian_{$i}_name"] ?? null);

            if ($guardianName === null) {
                continue;
            }

            $phone = $this->phone($data["guardian_{$i}_phone"] ?? null);

            if ($phone === null || ! preg_match(PhilippineMobileNumber::PATTERN, $phone)) {
                return $this->error("Phone for guardian \"{$guardianName}\" must be exactly 11 digits (09XXXXXXXXX).");
            }

            $relationship = $this->clean($data["guardian_{$i}_relationship"] ?? null);

            if ($relationship === null) {
                return $this->error("Missing relationship for guardian \"{$guardianName}\".");
            }

            $guardians[] = [
                'name' => $guardianName,
                'relationship' => $relationship,
                'phone_number' => $phone,
            ];
        }

        if ($guardians === []) {
            return $this->error('At least one guardian is required.');
        }

        $phoneNumber = $this->phone($data['phone_number'] ?? null);

        if ($phoneNumber !== null && ! preg_match(PhilippineMobileNumber::PATTERN, $phoneNumber)) {
            return $this->error('Student phone number must be exactly 11 digits (09XXXXXXXXX).');
        }

        $status = strtolower($this->clean($data['status'] ?? null) ?? 'active');

        if (! in_array($status, ['active', 'inactive'], true)) {
            $status = 'active';
        }

        $student = Student::admit([
            'name' => $name,
            'student_number' => $studentNumber,
            'phone_number' => $phoneNumber,
            'status' => $status,
        ], $placement, $guardians, $year);

        return ['status' => 'created', 'student' => $student];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{education_level: string, grade_level: string, course_id: int|null, section: string}|string the placement, or an error message
     */
    private function placement(array $data): array|string
    {
        $educationLevel = Student::resolveEducationLevel($this->clean($data['education_level'] ?? null));

        if ($educationLevel === null) {
            return 'Education level must be Junior High School, Senior High School, College or Graduate School.';
        }

        $gradeLevel = Student::resolveGradeLevel($educationLevel, $this->clean($data['grade_level'] ?? null));

        if ($gradeLevel === null) {
            return 'Year level must be one of: '.implode(', ', Student::EDUCATION_LEVELS[$educationLevel]['grade_levels']).'.';
        }

        $courseId = null;

        if (Course::requiredFor($educationLevel)) {
            $course = Course::resolve($educationLevel, $this->clean($data['course'] ?? null));

            if ($course === null) {
                $offered = Course::where('education_level', $educationLevel)->orderBy('code')->pluck('code');

                return $offered->isEmpty()
                    ? 'Add the courses for '.Student::EDUCATION_LEVELS[$educationLevel]['label'].' under Courses first.'
                    : 'Course must be one of: '.$offered->join(', ').'.';
            }

            $courseId = $course->id;
        }

        $rawSection = $this->clean($data['section'] ?? null);

        if ($rawSection === null) {
            return 'Missing section.';
        }

        $section = Section::resolve($educationLevel, $gradeLevel, $rawSection);

        if ($section === null) {
            return "\"{$rawSection}\" isn't a {$gradeLevel} section. Add it under Sections first, or check the Sections sheet of the template.";
        }

        return [
            'education_level' => $educationLevel,
            'grade_level' => $gradeLevel,
            'course_id' => $courseId,
            'section' => $section,
        ];
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /**
     * A phone cell Excel turned into a number loses its leading 0 (9171234567); put it back.
     */
    private function phone(mixed $value): ?string
    {
        $value = $this->clean($value);

        if ($value !== null && preg_match('/^9\d{9}$/', $value)) {
            return '0'.$value;
        }

        return $value;
    }

    /**
     * @return array{status: 'error', message: string}
     */
    private function error(string $message): array
    {
        return ['status' => 'error', 'message' => $message];
    }

    /**
     * @param  array{created: int, enrolled: int, unchanged: int, texted: int}  $counts
     * @param  list<string>  $errors
     */
    private function summarize(array $counts, string $year, array $errors): string
    {
        $parts = ["Imported {$counts['created']} new student(s) into S.Y. {$year}."];

        if ($counts['enrolled'] > 0) {
            $parts[] = "{$counts['enrolled']} existing student(s) enrolled or moved for S.Y. {$year}.";
        }

        if ($counts['unchanged'] > 0) {
            $parts[] = "{$counts['unchanged']} already up to date.";
        }

        if ($counts['texted'] > 0) {
            $parts[] = "Login details texted to {$counts['texted']} number(s).";
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
