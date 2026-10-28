<?php

use App\Models\Grade;
use App\Models\Section;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');
});

function gradesCsv(string $content): UploadedFile
{
    return UploadedFile::fake()->createWithContent('grades.csv', $content);
}

/**
 * @return list<list<string|null>>
 */
function templateRows(TestResponse $response): array
{
    $path = tempnam(sys_get_temp_dir(), 'grd').'.xlsx';
    file_put_contents($path, $response->streamedContent());
    $rows = IOFactory::load($path)->getSheetByName('Grades')->toArray(null, false, false);
    unlink($path);

    return $rows;
}

test('registrar can import k-12 grades and the final grade is averaged from the three terms', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    $csv = <<<'CSV'
    student_number,student_name,year_level,section,school_year,subject,term_1,term_2,term_3,final_grade,remarks
    LRN-0001,Juan Dela Cruz,Grade 8,St. Thomas,2026-2027,Mathematics,85,87,88,,
    LRN-0001,Juan Dela Cruz,Grade 8,St. Thomas,2026-2027,English,70,72,74,,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ])->assertRedirect(route('admin.grades.index'));

    $math = $student->grades()->where('subject', 'Mathematics')->firstOrFail();
    expect((float) $math->final_grade)->toBe(87.0)
        ->and($math->q4)->toBeNull()
        ->and($math->remarks)->toBe('Passed')
        ->and($math->encoded_by)->toBe($registrar->id);

    $english = $student->grades()->where('subject', 'English')->firstOrFail();
    expect($english->remarks)->toBe('Failed');
});

test('an excel file with the older q1 to q3 column names still imports', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    $book = new Spreadsheet;
    $book->getActiveSheet()->fromArray([
        ['student_number', 'school_year', 'subject', 'q1', 'q2', 'q3', 'q4'],
        ['LRN-0001', '2026-2027', 'Science', 80, 90, 85, 99],
    ]);
    $path = tempnam(sys_get_temp_dir(), 'grd').'.xlsx';
    (new Xlsx($book))->save($path);

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => new UploadedFile($path, 'grades.xlsx', null, null, true),
    ])->assertRedirect(route('admin.grades.index'));

    $grade = $student->grades()->firstOrFail();
    expect((float) $grade->final_grade)->toBe(85.0)
        ->and($grade->q4)->toBeNull();
});

test('re-importing the same subject and period updates the existing grade', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);

    $header = "student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks\n";

    foreach (['85,,,', '85,86,,'] as $quarters) {
        $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
            'grading_system' => 'k12',
            'file' => gradesCsv($header."LRN-0001,,2026-2027,Mathematics,{$quarters},,\n"),
        ]);
    }

    expect(Grade::count())->toBe(1)
        ->and((float) Grade::first()->q2)->toBe(86.0)
        ->and(Grade::first()->final_grade)->toBeNull();
});

test('college grades are stored per term with INC accepted as a final grade', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => '2026-00123', 'grading_system' => 'college']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,term,subject_code,subject,units,midterm,final_grade,remarks
    2026-00123,Ana Reyes,2026-2027,1st sem,IT 101,Introduction to Computing,3,1.75,1.50,
    2026-00123,Ana Reyes,2026-2027,1st sem,MATH 101,College Algebra,3,2.00,INC,
    2026-00123,Ana Reyes,2026-2027,1st sem,PE 1,Physical Education,2,,5.00,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'college',
        'file' => gradesCsv($csv),
    ]);

    $grades = $student->grades()->get()->keyBy('subject');

    expect($grades)->toHaveCount(3)
        ->and($grades['Introduction to Computing']->term)->toBe('1st Semester')
        ->and($grades['Introduction to Computing']->remarks)->toBe('Passed')
        ->and($grades['College Algebra']->final_grade)->toBeNull()
        ->and($grades['College Algebra']->remarks)->toBe('INC')
        ->and($grades['Physical Education']->remarks)->toBe('Failed');

    // GWA only counts graded subjects: (1.50*3 + 5.00*2) / 5
    expect(Grade::averageOf($grades->values(), 'college'))->toBe(2.9);
});

test('rows with invalid data are reported and skipped', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);
    Student::factory()->create(['student_number' => 'COL-0001', 'grading_system' => 'college']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks
    LRN-9999,,2026-2027,Mathematics,85,85,85,85,,
    LRN-0001,,2026,Mathematics,85,85,85,85,,
    LRN-0001,,2026-2027,Mathematics,105,85,85,85,,
    COL-0001,,2026-2027,Mathematics,85,85,85,85,,
    CSV;

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ])->assertSessionHasNoErrors();

    expect(Grade::count())->toBe(0);
});

test('teachers can only import grades for their assigned subject and section', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    Student::factory()->create(['student_number' => 'LRN-0001', 'section' => 'St. Thomas']);
    Student::factory()->create(['student_number' => 'LRN-0002', 'section' => 'St. Peter']);

    $csv = <<<'CSV'
    student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks
    LRN-0001,,2026-2027,mathematics,85,85,85,85,,
    LRN-0001,,2026-2027,English,85,85,85,85,,
    LRN-0002,,2026-2027,Mathematics,85,85,85,85,,
    CSV;

    $this->actingAs($teacher)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv($csv),
    ]);

    expect(Grade::count())->toBe(1)
        ->and(Grade::first()->student->student_number)->toBe('LRN-0001');
});

test('teachers only see and delete grades in their assigned classes', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Mathematics',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    $mine = Grade::factory()->for(Student::factory()->state(['section' => 'St. Thomas']))->create(['subject' => 'Mathematics']);
    $other = Grade::factory()->for(Student::factory()->state(['section' => 'St. Peter']))->create(['subject' => 'Mathematics']);

    $this->actingAs($teacher)->get(route('admin.grades.index'))
        ->assertInertia(fn ($page) => $page
            ->component('admin/grades/index')
            ->has('grades.data', 1)
            ->where('grades.data.0.id', $mine->id)
        );

    $this->actingAs($teacher)->delete(route('admin.grades.destroy', $other))->assertForbidden();
    $this->actingAs($teacher)->delete(route('admin.grades.destroy', $mine));

    expect(Grade::find($mine->id))->toBeNull()
        ->and(Grade::find($other->id))->not->toBeNull();
});

test('teachers can download a template pre-filled with their class list', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $assignment = TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Science',
        'section' => 'St. Thomas',
        'school_year' => '2026-2027',
    ]);

    Student::factory()->create(['name' => 'In Section', 'student_number' => 'LRN-0001', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    Student::factory()->create(['name' => 'Other Section', 'section' => 'St. Peter']);

    $response = $this->actingAs($teacher)
        ->get(route('admin.grades.import.template', ['system' => 'k12', 'assignment' => $assignment->id]));

    $response->assertOk()
        ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    expect(templateRows($response))->toBe([
        ['student_number', 'student_name', 'year_level', 'section', 'school_year', 'subject', 'term_1', 'term_2', 'term_3', 'final_grade', 'remarks'],
        ['LRN-0001', 'In Section', 'Grade 8', 'St. Thomas', '2026-2027', 'Science', null, null, null, null, null],
    ]);

    $otherTeacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $this->actingAs($otherTeacher)
        ->get(route('admin.grades.import.template', ['system' => 'k12', 'assignment' => $assignment->id]))
        ->assertForbidden();
});

test('registrar can download a template of the students enrolled in a year level and section', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Section::create(['education_level' => 'jhs', 'grade_level' => 'Grade 8', 'name' => 'St. Thomas']);

    $moved = Student::factory()->create(['name' => 'Moved Up', 'student_number' => 'LRN-0001', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $moved->enroll('2025-2026', ['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'section' => 'St. Peter']);
    Student::factory()->create(['name' => 'Other Section', 'grade_level' => 'Grade 8', 'section' => 'St. Paul']);
    Student::factory()->create(['name' => 'Not Enrolled', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas'])
        ->enrollments()->delete();

    $response = $this->actingAs($registrar)->get(route('admin.grades.import.template', [
        'system' => 'k12',
        'school_year' => '2026-2027',
        'education_level' => 'jhs',
        'grade_level' => 'Grade 8',
        'section' => 'St. Thomas',
        'subject' => 'Mathematics',
    ]));

    expect(array_slice(templateRows($response), 1))->toBe([
        ['LRN-0001', 'Moved Up', 'Grade 8', 'St. Thomas', '2026-2027', 'Mathematics', null, null, null, null, null],
    ]);

    // Last year's list shows where the student was then.
    $lastYear = $this->get(route('admin.grades.import.template', ['system' => 'k12', 'school_year' => '2025-2026', 'section' => 'St. Peter']));

    expect(templateRows($lastYear)[1])->toBe(['LRN-0001', 'Moved Up', 'Grade 7', 'St. Peter', '2025-2026', null, null, null, null, null, null]);
});

test('teachers can only download templates for their own classes', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)
        ->get(route('admin.grades.import.template', ['system' => 'k12', 'section' => 'St. Thomas']))
        ->assertForbidden();

    $this->get(route('admin.grades.import.template', ['system' => 'k12']))->assertOk();
});

test('a teacher keeps last year\'s class after the students move to a new section', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'subject' => 'Mathematics',
        'section' => 'St. Peter',
        'school_year' => '2025-2026',
    ]);

    $student = Student::factory()->create(['student_number' => 'LRN-0001', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas']);
    $student->enroll('2025-2026', ['education_level' => 'jhs', 'grade_level' => 'Grade 7', 'section' => 'St. Peter']);

    $this->actingAs($teacher)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => gradesCsv("student_number,school_year,subject,term_1,term_2,term_3\nLRN-0001,2025-2026,Mathematics,85,86,87\nLRN-0001,2026-2027,Mathematics,85,86,87\n"),
    ]);

    expect(Grade::pluck('school_year')->all())->toBe(['2025-2026']);

    $this->get(route('admin.grades.index', ['school_year' => '2025-2026']))
        ->assertInertia(fn ($page) => $page
            ->has('grades.data', 1)
            ->where('grades.data.0.section', 'St. Peter')
        );
});

test('the grade list opens on the school year being viewed', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Grade::factory()->create(['school_year' => '2026-2027']);
    Grade::factory()->create(['school_year' => '2025-2026']);

    $this->actingAs($registrar)->get(route('admin.grades.index'))
        ->assertInertia(fn ($page) => $page->has('grades.data', 1)->where('filters.school_year', '2026-2027'));

    $this->get(route('admin.grades.index', ['school_year' => 'all']))
        ->assertInertia(fn ($page) => $page->has('grades.data', 2));
});
