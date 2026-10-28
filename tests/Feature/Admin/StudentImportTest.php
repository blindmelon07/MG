<?php

use App\Jobs\SendSmsJob;
use App\Models\Course;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

uses(RefreshDatabase::class);

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');

    $bsit = Course::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'education_level' => 'college']);

    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St. Thomas']);
    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'name' => 'St. Peter']);
    Section::create(['education_level' => 'shs', 'grade_level' => 'Grade 11', 'name' => 'St. Thomas']);
    Section::create(['education_level' => 'college', 'grade_level' => '1st Year', 'course_id' => $bsit->id, 'name' => 'BSIT 1-A']);
    Section::create(['education_level' => 'college', 'grade_level' => '2nd Year', 'course_id' => $bsit->id, 'name' => 'BSIT 2-A']);
});

const STUDENT_IMPORT_HEADER = 'name,student_number,education_level,grade_level,course,section,status,phone_number,guardian_1_name,guardian_1_relationship,guardian_1_phone,guardian_2_name,guardian_2_relationship,guardian_2_phone';

function studentImportCsv(string $rows): UploadedFile
{
    return UploadedFile::fake()->createWithContent('students.csv', STUDENT_IMPORT_HEADER."\n".$rows);
}

test('admin can download the excel template with level dropdowns', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->get(route('admin.students.import.template'));

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
    file_put_contents($path, $response->streamedContent());
    $book = IOFactory::load($path);
    $sheet = $book->getSheetByName('Students');

    expect($sheet->rangeToArray('A1:N1')[0])->toContain('education_level', 'grade_level', 'course', 'guardian_1_name')
        ->and($sheet->getCell('C2')->getDataValidation()->getType())->toBe(DataValidation::TYPE_LIST)
        ->and($sheet->getCell('D2')->getDataValidation()->getFormula1())->toContain('INDIRECT')
        ->and($sheet->getCell('E2')->getDataValidation()->getFormula1())->toBe('Courses')
        ->and($book->getNamedRange('Junior_High_School'))->not->toBeNull()
        ->and($book->getSheetByName('Sections')->rangeToArray('A1:D6'))->toContain(['College', '1st Year', 'BSIT', 'BSIT 1-A']);

    unlink($path);
});

test('importing a csv creates students with their guardians', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv(implode("\n", [
            'Juan Dela Cruz,LRN-0001,Junior High School,Grade 8,,st. thomas,active,,Maria Dela Cruz,Mother,09171234567,Jose Dela Cruz,Father,09181234567',
            'Ana Reyes,LRN-0002,College,1st Year,bsit,BSIT 1-A,active,,Elena Reyes,Mother,09191234567,,,',
        ])),
    ])->assertRedirect(route('admin.students.index'));

    $juan = Student::where('student_number', 'LRN-0001')->firstOrFail();
    expect($juan->guardians)->toHaveCount(2)
        ->and($juan->education_level)->toBe('jhs')
        ->and($juan->grading_system)->toBe('k12')
        ->and($juan->section)->toBe('St. Thomas')
        ->and($juan->password)->toBeNull();

    $ana = Student::where('student_number', 'LRN-0002')->firstOrFail();
    expect($ana->guardians)->toHaveCount(1)
        ->and($ana->education_level)->toBe('college')
        ->and($ana->grading_system)->toBe('college')
        ->and($ana->course->code)->toBe('BSIT');
});

test('importing an excel file restores phone numbers that lost their leading zero', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $book = new Spreadsheet;
    $book->getActiveSheet()->fromArray([
        explode(',', STUDENT_IMPORT_HEADER),
        ['Juan Dela Cruz', 'LRN-0001', 'SHS', '11', null, 'St. Thomas', 'active', null, 'Maria Dela Cruz', 'Mother', 9171234567],
    ]);
    $path = tempnam(sys_get_temp_dir(), 'imp').'.xlsx';
    (new Xlsx($book))->save($path);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => new UploadedFile($path, 'students.xlsx', null, null, true),
    ])->assertRedirect(route('admin.students.index'));

    $juan = Student::where('student_number', 'LRN-0001')->firstOrFail();
    expect($juan->education_level)->toBe('shs')
        ->and($juan->grade_level)->toBe('Grade 11')
        ->and($juan->guardians->first()->phone_number)->toBe('09171234567');
});

test('an existing student number enrolls that student in the year being viewed', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001', 'name' => 'Juan Dela Cruz', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $student->enrollments()->where('school_year', '2026-2027')->delete();

    $this->actingAs($admin)->post(route('admin.school-year.select'), ['school_year' => '2025-2026']);
    $this->post(route('admin.students.import.store'), [
        'file' => studentImportCsv('Renamed,LRN-0001,Junior High School,Grade 7,,St. Peter,active,,Maria Dela Cruz,Mother,09171234567,,,'),
    ]);

    $student->refresh();
    expect(Student::where('student_number', 'LRN-0001')->count())->toBe(1)
        ->and($student->name)->toBe('Juan Dela Cruz')
        ->and($student->section)->toBe('St. Thomas')
        ->and($student->enrollmentFor('2025-2026')->section)->toBe('St. Peter');
});

test('importing can text the login to each new student and their guardians', function () {
    Queue::fake();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'send_credentials' => '1',
        'file' => studentImportCsv('Juan Dela Cruz,LRN-0001,Junior High School,Grade 8,,St. Thomas,active,09991234567,Maria Dela Cruz,Mother,09171234567,Jose Dela Cruz,Father,09181234567'),
    ]);

    expect(Student::where('student_number', 'LRN-0001')->value('password'))->not->toBeNull();
    Queue::assertPushed(SendSmsJob::class, 3);
});

test('importing rejects sections and courses that are not on the lists', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv(implode("\n", [
            'Unknown Section,LRN-0010,Junior High School,Grade 8,,St. Nobody,active,,Maria,Mother,09171234567,,,',
            'No Course,LRN-0011,College,1st Year,,BSIT 1-A,active,,Maria,Mother,09171234567,,,',
            'Wrong Course,LRN-0012,College,1st Year,BSN,BSIT 1-A,active,,Maria,Mother,09171234567,,,',
        ])),
    ]);

    expect(Student::count())->toBe(0);
});

test('importing rejects rows with missing or invalid required data', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv(implode("\n", [
            ',LRN-0003,Junior High School,Grade 8,,St. Thomas,active,,Maria,Mother,09171234567,,,',
            'No Guardian Student,LRN-0004,Junior High School,Grade 8,,St. Thomas,active,,,,,,,',
            'No Number,,Junior High School,Grade 8,,St. Thomas,active,,Maria,Mother,09171234567,,,',
            'Wrong Year,LRN-0005,Junior High School,Grade 11,,St. Thomas,active,,Maria,Mother,09171234567,,,',
            'No Section,LRN-0006,Junior High School,Grade 8,,,active,,Maria,Mother,09171234567,,,',
            'Short Phone,LRN-0007,Junior High School,Grade 8,,St. Thomas,active,,Maria,Mother,0917123456,,,',
            'No Level,LRN-0008,,Grade 8,,St. Thomas,active,,Maria,Mother,09171234567,,,',
        ])),
    ]);

    expect(Student::count())->toBe(0);
});

test('importing accepts a bare number as the year level', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)->post(route('admin.students.import.store'), [
        'file' => studentImportCsv('Ana Reyes,LRN-0002,College,2,BSIT,BSIT 2-A,active,,Elena Reyes,Mother,09191234567,,,'),
    ])->assertRedirect(route('admin.students.index'));

    expect(Student::where('student_number', 'LRN-0002')->value('grade_level'))->toBe('2nd Year');
});
