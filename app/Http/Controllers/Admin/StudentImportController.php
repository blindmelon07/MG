<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Rules\PhilippineMobileNumber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\NamedRange;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
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
        $headers = ['name', 'student_number', 'education_level', 'grade_level', 'section', 'status', 'phone_number'];

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
        $spreadsheet = new Spreadsheet;

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Students');
        $sheet->fromArray([$headers, [
            'Juan Dela Cruz', 'LRN-00012345', 'Junior High School', 'Grade 8', 'St. Thomas', 'active', '',
            'Maria Dela Cruz', 'Mother', '09171234567',
            'Jose Dela Cruz', 'Father', '09181234567',
        ]], null, 'A1', true);
        $sheet->getStyle('A1:'.$this->column(count($headers)).'1')->getFont()->setBold(true);
        $sheet->freezePane('A2');

        foreach (range(1, count($headers)) as $index) {
            $sheet->getColumnDimension($this->column($index))->setAutoSize(true);
        }

        $this->addLists($spreadsheet);

        $lastRow = self::TEMPLATE_ROWS + 1;
        $levelColumn = $this->column(array_search('education_level', $headers, true) + 1);

        $this->addDropdown($sheet, "{$levelColumn}2:{$levelColumn}{$lastRow}", 'EducationLevels', 'Pick an education level.');
        // INDIRECT turns "Junior High School" into the named range Junior_High_School.
        $gradeColumn = $this->column(array_search('grade_level', $headers, true) + 1);
        $this->addDropdown($sheet, "{$gradeColumn}2:{$gradeColumn}{$lastRow}", "INDIRECT(SUBSTITUTE({$levelColumn}2,\" \",\"_\"))", 'Pick the education level first, then a year level.');
        $statusColumn = $this->column(array_search('status', $headers, true) + 1);
        $this->addDropdown($sheet, "{$statusColumn}2:{$statusColumn}{$lastRow}", '"active,inactive"', 'active or inactive.');

        // Stored as text so Excel keeps the leading 0 of 09XXXXXXXXX.
        foreach ($headers as $index => $header) {
            if (str_ends_with($header, 'phone') || $header === 'phone_number' || $header === 'student_number') {
                $column = $this->column($index + 1);
                $sheet->getStyle("{$column}2:{$column}{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
            }
        }

        $spreadsheet->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($spreadsheet) {
            (new Xlsx($spreadsheet))->save('php://output');
        }, 'students-import-template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * A "Lists" sheet holding the dropdown values, one named range per education level.
     */
    private function addLists(Spreadsheet $spreadsheet): void
    {
        $lists = $spreadsheet->createSheet();
        $lists->setTitle('Lists');

        $levels = array_values(Student::EDUCATION_LEVELS);

        foreach ($levels as $index => $level) {
            $column = $this->column($index + 1);
            $lists->setCellValue("{$column}1", $level['label']);
            $lists->fromArray(array_map(fn ($grade) => [$grade], $level['grade_levels']), null, "{$column}2");

            $last = count($level['grade_levels']) + 1;
            $spreadsheet->addNamedRange(new NamedRange(str_replace(' ', '_', $level['label']), $lists, "\${$column}\$2:\${$column}\${$last}"));
        }

        $spreadsheet->addNamedRange(new NamedRange('EducationLevels', $lists, '$A$1:$'.$this->column(count($levels)).'$1'));
        $lists->setSheetState(Worksheet::SHEETSTATE_HIDDEN);
    }

    private function addDropdown(Worksheet $sheet, string $range, string $formula, string $prompt): void
    {
        $validation = new DataValidation;
        $validation->setType(DataValidation::TYPE_LIST)
            ->setErrorStyle(DataValidation::STYLE_STOP)
            ->setAllowBlank(false)
            ->setShowDropDown(true)
            ->setShowErrorMessage(true)
            ->setShowInputMessage(true)
            ->setError('Choose a value from the list.')
            ->setPrompt($prompt)
            ->setFormula1($formula);

        $sheet->setDataValidation($range, $validation);
    }

    private function column(int $index): string
    {
        return Coordinate::stringFromColumnIndex($index);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
        ]);

        try {
            $rows = $this->readRows($request->file('file')->getRealPath(), $request->file('file')->getClientOriginalExtension());
        } catch (Throwable) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('The file could not be read. Use the Excel template or a CSV file.')]);

            return to_route('admin.students.index');
        }

        $header = array_map(fn ($column) => strtolower(trim((string) $column)), array_shift($rows) ?? []);

        $created = 0;
        $skipped = 0;
        $errors = [];
        $rowNumber = 1;

        foreach ($rows as $row) {
            $rowNumber++;

            if (count(array_filter($row, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $data = array_combine($header, array_slice(array_pad($row, count($header), null), 0, count($header)));
            $result = $this->importRow($data);

            match ($result['status']) {
                'created' => $created++,
                'skipped' => $skipped++,
                'error' => $errors[] = "Row {$rowNumber}: {$result['message']}",
            };
        }

        Inertia::flash('toast', [
            'type' => $errors === [] ? 'success' : ($created > 0 ? 'warning' : 'error'),
            'message' => $this->summarize($created, $skipped, $errors),
        ]);

        return to_route('admin.students.index');
    }

    /**
     * Rows of the first sheet (Excel) or of the CSV, as strings.
     *
     * @return list<list<string|null>>
     */
    private function readRows(string $path, string $extension): array
    {
        $extension = strtolower($extension);

        if (in_array($extension, ['csv', 'txt'], true)) {
            $handle = fopen($path, 'r');

            if ($handle === false) {
                abort(422, 'Unable to read the uploaded file.');
            }

            $rows = [];

            while (($row = fgetcsv($handle)) !== false) {
                $rows[] = $row;
            }

            fclose($handle);

            return $rows;
        }

        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);

        return array_values(array_map(
            fn (array $row) => array_values(array_map(fn ($value) => $value === null ? null : (string) $value, $row)),
            $reader->load($path)->getSheet(0)->toArray(null, false, false),
        ));
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

        if ($studentNumber === null) {
            return ['status' => 'error', 'message' => 'Missing student number.'];
        }

        if (Student::where('student_number', $studentNumber)->exists()) {
            return ['status' => 'skipped', 'message' => null];
        }

        $educationLevel = Student::resolveEducationLevel($this->clean($data['education_level'] ?? null));

        if ($educationLevel === null) {
            return ['status' => 'error', 'message' => 'Education level must be Junior High School, Senior High School, College or Graduate School.'];
        }

        $gradeLevel = Student::resolveGradeLevel($educationLevel, $this->clean($data['grade_level'] ?? null));

        if ($gradeLevel === null) {
            $allowed = implode(', ', Student::EDUCATION_LEVELS[$educationLevel]['grade_levels']);

            return ['status' => 'error', 'message' => "Year level must be one of: {$allowed}."];
        }

        $section = $this->clean($data['section'] ?? null);

        if ($section === null) {
            return ['status' => 'error', 'message' => 'Missing section.'];
        }

        $guardians = [];

        for ($i = 1; $i <= self::GUARDIAN_SLOTS; $i++) {
            $guardianName = $this->clean($data["guardian_{$i}_name"] ?? null);

            if ($guardianName === null) {
                continue;
            }

            $phone = $this->phone($data["guardian_{$i}_phone"] ?? null);

            if ($phone === null || ! preg_match(PhilippineMobileNumber::PATTERN, $phone)) {
                return ['status' => 'error', 'message' => "Phone for guardian \"{$guardianName}\" must be exactly 11 digits (09XXXXXXXXX)."];
            }

            $relationship = $this->clean($data["guardian_{$i}_relationship"] ?? null);

            if ($relationship === null) {
                return ['status' => 'error', 'message' => "Missing relationship for guardian \"{$guardianName}\"."];
            }

            $guardians[] = [
                'name' => $guardianName,
                'relationship' => $relationship,
                'phone_number' => $phone,
            ];
        }

        if ($guardians === []) {
            return ['status' => 'error', 'message' => 'At least one guardian is required.'];
        }

        $phoneNumber = $this->phone($data['phone_number'] ?? null);

        if ($phoneNumber !== null && ! preg_match(PhilippineMobileNumber::PATTERN, $phoneNumber)) {
            return ['status' => 'error', 'message' => 'Student phone number must be exactly 11 digits (09XXXXXXXXX).'];
        }

        $status = strtolower($this->clean($data['status'] ?? null) ?? 'active');

        if (! in_array($status, ['active', 'inactive'], true)) {
            $status = 'active';
        }

        DB::transaction(function () use ($name, $studentNumber, $educationLevel, $gradeLevel, $section, $status, $phoneNumber, $guardians): void {
            $student = Student::create([
                'name' => $name,
                'student_number' => $studentNumber,
                'education_level' => $educationLevel,
                'grade_level' => $gradeLevel,
                'section' => $section,
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
