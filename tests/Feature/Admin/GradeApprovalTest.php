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

/** The pending subject the shared test row belongs to. */
function introToComputing(User $teacher, array $extra = []): array
{
    return ['school_year' => '2026-2027', 'term' => '1st Semester', 'subject' => 'Introduction to Computing', 'encoded_by' => $teacher->id, ...$extra];
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

    $this->actingAs($registrar)->post(route('admin.grades.approve'), introToComputing($teacher))->assertRedirect();

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
    $this->actingAs($registrar)->post(route('admin.grades.approve'), introToComputing($teacher));

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

test('the registrar sees pending grades grouped into one entry per subject', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->create(['role' => 'teacher', 'name' => 'Ramon Cruz']);
    $other = User::factory()->create(['role' => 'teacher']);
    $calculus = ['grading_system' => 'college', 'term' => '1st Semester', 'subject' => 'Calculus', 'subject_code' => 'MATH 101', 'encoded_by' => $teacher->id];

    Grade::factory()->pending()->count(3)->create($calculus);
    Grade::factory()->pending()->create([...$calculus, 'encoded_by' => $other->id]);
    Grade::factory()->pending()->create([...$calculus, 'term' => '2nd Semester']);
    Grade::factory()->create($calculus); // already posted

    $this->actingAs($registrar)->get(route('admin.grades.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('pendingSubjects', 3)
            ->where('pendingSubjects.0.subject', 'Calculus')
            ->where('pendingSubjects.0.subject_code', 'MATH 101')
            ->where('pendingSubjects.0.term', '1st Semester'));

    $teacherSubject = collect($this->get(route('admin.grades.index'))->inertiaProps('pendingSubjects'))
        ->firstWhere('encoded_by', $teacher->id);
    expect($teacherSubject)->toMatchArray(['teacher' => 'Ramon Cruz', 'count' => 3]);
});

test('approving a subject posts all of its pending grades and nothing else', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $teacher = User::factory()->create(['role' => 'teacher']);
    $calculus = ['grading_system' => 'college', 'term' => '1st Semester', 'subject' => 'Calculus', 'encoded_by' => $teacher->id];

    Grade::factory()->pending()->count(3)->create($calculus);
    $otherTerm = Grade::factory()->pending()->create([...$calculus, 'term' => '2nd Semester']);
    $otherTeacher = Grade::factory()->pending()->create([...$calculus, 'encoded_by' => User::factory()->create(['role' => 'teacher'])->id]);
    $physics = Grade::factory()->pending()->create([...$calculus, 'subject' => 'Physics']);

    $this->actingAs($registrar)
        ->post(route('admin.grades.approve'), ['school_year' => '2026-2027', 'term' => '1st Semester', 'subject' => 'Calculus', 'encoded_by' => $teacher->id])
        ->assertRedirect();

    expect(Grade::posted()->where('encoded_by', $teacher->id)->where('term', '1st Semester')->where('subject', 'Calculus')->count())->toBe(3)
        ->and(Grade::pendingApproval()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$otherTerm->id, $otherTeacher->id, $physics->id])->sort()->values()->all());
});

test('a subject saved without a term or uploader can still be approved', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Grade::factory()->pending()->count(2)->create(['grading_system' => 'college', 'subject' => 'Ethics']);

    $this->actingAs($registrar)->post(route('admin.grades.approve'), ['school_year' => '2026-2027', 'term' => null, 'subject' => 'Ethics', 'encoded_by' => null]);

    expect(Grade::pendingApproval()->count())->toBe(0);
});

test('grades can no longer be approved one by one', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $grade = Grade::factory()->pending()->create(['grading_system' => 'college']);

    $this->actingAs($registrar)->post(route('admin.grades.approve'), ['ids' => [$grade->id]])
        ->assertSessionHasErrors(['school_year', 'subject']);

    expect($grade->fresh()->isPosted())->toBeFalse();
});

test('teachers cannot approve grades or delete posted college grades', function () {
    $teacher = collegeTeacher();
    collegeStudent();
    importCollege($teacher, "2026-00123,,,BSIT 1-A,2026-2027,1st Semester,IT 101,Introduction to Computing,3,1.25,1.50,1.75,,\n");
    $grade = Grade::sole();

    $this->actingAs($teacher)->post(route('admin.grades.approve'), introToComputing($teacher))->assertForbidden();

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

    $this->actingAs($registrar)->post(route('admin.grades.return'), introToComputing($teacher, ['reason' => '']))
        ->assertSessionHasErrors('reason');

    $this->actingAs($registrar)->post(route('admin.grades.return'), introToComputing($teacher, ['reason' => 'Finals grade is missing.']))
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

    $this->actingAs($teacher)->post(route('admin.grades.return'), ['school_year' => '2026-2027', 'subject' => $grade->subject, 'reason' => 'x'])
        ->assertForbidden();
});
