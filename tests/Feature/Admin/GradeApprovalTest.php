<?php

use App\Models\Advisory;
use App\Models\Grade;
use App\Models\GradeAudit;
use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Notifications\GradesReturned;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    schoolYears('2026-2027');
});

const COLLEGE_HEADER = "student_number,student_name,year_level,section,school_year,term,subject_code,subject,units,prelim,midterm,finals,grade,remarks\n";

function collegeTeacher(): User
{
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    TeachingAssignment::create([
        'user_id' => $teacher->id,
        'education_level' => 'college',
        'grade_level' => '1st Year',
        'subject' => 'Introduction to Computing',
        'section' => 'BSIT 1-A',
        'school_year' => '2026-2027',
    ]);

    return $teacher;
}

function collegeStudent(): Student
{
    return Student::factory()->create([
        'student_number' => '2026-00123',
        'grading_system' => 'college',
        'education_level' => 'college',
        'grade_level' => '1st Year',
        'section' => 'BSIT 1-A',
    ]);
}

function importCollege(User $user, string $rows): void
{
    test()->actingAs($user)->post(route('admin.grades.import.store'), [
        'grading_system' => 'college',
        'file' => UploadedFile::fake()->createWithContent('grades.csv', COLLEGE_HEADER.$rows),
    ])->assertRedirect(route('admin.grades.index'));
}

test('college grades a teacher uploads wait for approval and stay hidden from the student', function () {
    $teacher = collegeTeacher();
    $student = collegeStudent();

    importCollege($teacher, "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,1.75,,\n");

    $grade = Grade::sole();
    expect($grade->isPosted())->toBeFalse();

    $this->actingAs($student, 'student')->get(route('student.grades'))
        ->assertInertia(fn (Assert $page) => $page->has('periods', 0));

    $this->actingAs($teacher)->get(route('admin.grades.index'))
        ->assertInertia(fn (Assert $page) => $page->where('pendingCount', 1)->where('canApprove', false));
});

test('the registrar approves pending grades and they are posted to the student', function () {
    $teacher = collegeTeacher();
    $student = collegeStudent();
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    importCollege($teacher, "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,1.75,,\n");
    $grade = Grade::sole();

    $this->actingAs($registrar)->get(route('admin.grades.index', ['status' => 'pending']))
        ->assertInertia(fn (Assert $page) => $page->where('pendingCount', 1)->where('canApprove', true)->has('grades.data', 1));

    $this->actingAs($registrar)->post(route('admin.grades.approve'), ['ids' => [$grade->id]])->assertRedirect();

    expect($grade->fresh())
        ->isPosted()->toBeTrue()
        ->approved_by->toBe($registrar->id)
        ->and(GradeAudit::where('event', 'approved')->sole()->user_id)->toBe($registrar->id);

    $this->actingAs($student, 'student')->get(route('student.grades'))
        ->assertInertia(fn (Assert $page) => $page->has('periods', 1));
});

test('a teacher change to a posted college grade needs approval again', function () {
    $teacher = collegeTeacher();
    collegeStudent();
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $row = "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,%s,,\n";

    importCollege($teacher, sprintf($row, '1.75'));
    $this->actingAs($registrar)->post(route('admin.grades.approve'), ['ids' => [Grade::sole()->id]]);

    // Same values again: stays posted.
    importCollege($teacher, sprintf($row, '1.75'));
    expect(Grade::sole()->isPosted())->toBeTrue();

    importCollege($teacher, sprintf($row, '2.00'));
    expect(Grade::sole()->isPosted())->toBeFalse();
});

test('registrar uploads and k-12 grades are posted right away', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    collegeStudent();
    importCollege($registrar, "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,1.75,,\n");

    $adviser = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    Advisory::create(['user_id' => $adviser->id, 'education_level' => 'jhs', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas', 'school_year' => '2026-2027']);
    Student::factory()->create(['student_number' => 'LRN-0001', 'education_level' => 'jhs', 'grade_level' => 'Grade 8', 'section' => 'St. Thomas']);

    $this->actingAs($adviser)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => UploadedFile::fake()->createWithContent('grades.csv', "student_number,student_name,year_level,section,school_year,subject,term_1,term_2,term_3,final_grade,remarks\nLRN-0001,,Grade 8,St. Thomas,2026-2027,Mathematics,85,87,88,,\n"),
    ]);

    expect(Grade::count())->toBe(2)
        ->and(Grade::pendingApproval()->count())->toBe(0);
});

test('approve all posts every pending grade matching the filters', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Grade::factory()->pending()->count(3)->create(['grading_system' => 'college', 'subject' => 'Calculus']);
    Grade::factory()->pending()->create(['grading_system' => 'college', 'subject' => 'Physics']);

    $this->actingAs($registrar)->post(route('admin.grades.approve'), ['all' => true, 'subject' => 'Calculus']);

    expect(Grade::posted()->where('subject', 'Calculus')->count())->toBe(3)
        ->and(Grade::pendingApproval()->sole()->subject)->toBe('Physics');
});

test('teachers cannot approve grades or delete posted college grades', function () {
    $teacher = collegeTeacher();
    collegeStudent();
    importCollege($teacher, "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,1.75,,\n");
    $grade = Grade::sole();

    $this->actingAs($teacher)->post(route('admin.grades.approve'), ['ids' => [$grade->id]])->assertForbidden();

    $grade->approve(User::factory()->create(['role' => 'registrar']));

    $this->actingAs($teacher)->delete(route('admin.grades.destroy', $grade));
    expect(Grade::count())->toBe(1);
});

test('the registrar can return pending grades to the teacher with a reason', function () {
    Notification::fake();

    $teacher = collegeTeacher();
    $student = collegeStudent();
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar', 'name' => 'Liza Bautista']);
    $row = "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,%s,,\n";

    importCollege($teacher, sprintf($row, ''));
    $grade = Grade::sole();

    $this->actingAs($registrar)->post(route('admin.grades.return'), ['ids' => [$grade->id], 'reason' => ''])
        ->assertSessionHasErrors('reason');

    $this->actingAs($registrar)->post(route('admin.grades.return'), ['ids' => [$grade->id], 'reason' => 'Finals grade is missing.'])
        ->assertRedirect();

    $grade->refresh();
    expect($grade->isReturned())->toBeTrue()
        ->and($grade->isPosted())->toBeFalse()
        ->and($grade->return_reason)->toBe('Finals grade is missing.')
        ->and(GradeAudit::where('event', 'returned')->sole()->new_values['return_reason'])->toBe('Finals grade is missing.');

    Notification::assertSentTo($teacher, GradesReturned::class, fn (GradesReturned $n) => $n->count === 1
        && $n->reason === 'Finals grade is missing.'
        && $n->subjects === ['Introduction to Computing']);

    // Returned grades wait for the teacher, so they leave the registrar's queue.
    $this->actingAs($registrar)->get(route('admin.grades.index'))
        ->assertInertia(fn (Assert $page) => $page->where('pendingCount', 0)->where('returnedCount', 1));
    $this->actingAs($teacher)->get(route('admin.grades.index', ['status' => 'returned']))
        ->assertInertia(fn (Assert $page) => $page->where('returnedCount', 1)->has('grades.data', 1));
    $this->actingAs($student, 'student')->get(route('student.grades'))
        ->assertInertia(fn (Assert $page) => $page->has('periods', 0));

    // The teacher's correction goes back to the registrar.
    importCollege($teacher, sprintf($row, '1.75'));
    $grade->refresh();
    expect($grade->isReturned())->toBeFalse()
        ->and($grade->return_reason)->toBeNull()
        ->and(Grade::pendingApproval()->count())->toBe(1);
});

test('teachers cannot return grades', function () {
    $teacher = collegeTeacher();
    $grade = Grade::factory()->pending()->create(['grading_system' => 'college']);

    $this->actingAs($teacher)->post(route('admin.grades.return'), ['ids' => [$grade->id], 'reason' => 'x'])
        ->assertForbidden();
});
