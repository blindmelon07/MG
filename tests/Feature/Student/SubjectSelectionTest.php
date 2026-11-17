<?php

use App\Models\Course;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\Subject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function subjectChooser(Course $course): Student
{
    $student = Student::factory()->create([
        'education_level' => 'college',
        'grade_level' => '1st Year',
        'course_id' => $course->id,
    ]);
    $student->password = 'correct-horse-9';
    $student->must_change_password = false;
    $student->save();

    return $student;
}

function offeredSubject(string $name, ?Course $course = null, ?string $semester = null, string $level = 'college'): Subject
{
    return Subject::create([
        'name' => $name,
        'education_level' => $level,
        'course_id' => $course?->id,
        'semester' => $semester,
        'units' => 3,
    ]);
}

beforeEach(function () {
    $this->course = Course::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'education_level' => 'college']);
    $this->otherCourse = Course::create(['code' => 'BSN', 'name' => 'BS Nursing', 'education_level' => 'college']);
});

test('a college student sees the subjects offered to their course', function () {
    $student = subjectChooser($this->course);
    $own = offeredSubject('Programming 1', $this->course, '1st Semester');
    $general = offeredSubject('Purposive Communication');
    offeredSubject('Anatomy', $this->otherCourse);
    offeredSubject('Thesis Writing', level: 'graduate');

    $this->actingAs($student, 'student')->get(route('student.subjects.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('student/subjects')
            ->where('schoolYear', SchoolYear::current())
            ->has('subjects', 2)
            ->where('subjects.0.id', $own->id)
            ->where('subjects.1.id', $general->id));
});

test('a student chooses subjects for a semester', function () {
    $student = subjectChooser($this->course);
    $first = offeredSubject('Programming 1', $this->course, '1st Semester');
    $general = offeredSubject('Purposive Communication');

    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '1st Semester',
        'subject_ids' => [$first->id, $general->id],
    ])->assertRedirect(route('student.subjects.index'));

    $chosen = $student->subjects()->get();
    expect($chosen->pluck('id')->sort()->values()->all())->toBe([$first->id, $general->id])
        ->and($chosen->first()->pivot->school_year)->toBe(SchoolYear::current())
        ->and($chosen->first()->pivot->semester)->toBe('1st Semester');

    // Saving again replaces that semester's choices.
    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '1st Semester',
        'subject_ids' => [$first->id],
    ]);

    expect($student->subjects()->pluck('subjects.id')->all())->toBe([$first->id]);
});

test('a student cannot choose a subject outside its semester or course', function () {
    $student = subjectChooser($this->course);
    $secondSem = offeredSubject('Programming 2', $this->course, '2nd Semester');
    $otherCourse = offeredSubject('Anatomy', $this->otherCourse);

    foreach ([$secondSem, $otherCourse] as $subject) {
        $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
            'semester' => '1st Semester',
            'subject_ids' => [$subject->id],
        ])->assertSessionHasErrors('subject_ids.0');
    }

    expect($student->subjects()->count())->toBe(0);
});

test('a subject is taken in only one semester of a school year', function () {
    $student = subjectChooser($this->course);
    $general = offeredSubject('Purposive Communication');

    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '1st Semester',
        'subject_ids' => [$general->id],
    ])->assertSessionHasNoErrors();

    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '2nd Semester',
        'subject_ids' => [$general->id],
    ])->assertSessionHasErrors('subject_ids.0');

    // Clearing the 2nd semester leaves the 1st semester alone.
    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '2nd Semester',
        'subject_ids' => [],
    ])->assertSessionHasNoErrors();

    expect($student->subjects()->count())->toBe(1);
});

test('students below college do not choose subjects', function () {
    $student = Student::factory()->create(['education_level' => 'jhs', 'grade_level' => 'Grade 7']);
    $student->password = 'correct-horse-9';
    $student->must_change_password = false;
    $student->save();

    $this->actingAs($student, 'student')->get(route('student.subjects.index'))
        ->assertRedirect(route('student.grades'));

    $this->actingAs($student, 'student')->put(route('student.subjects.update'), [
        'semester' => '1st Semester',
        'subject_ids' => [],
    ])->assertForbidden();
});

test('the subjects page lists the year level of each subject', function () {
    $student = subjectChooser($this->course);
    $subject = offeredSubject('Programming 2', $this->course);
    $subject->update(['year_level' => '2nd Year']);

    $this->actingAs($student, 'student')->get(route('student.subjects.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('yearLevel', '1st Year')
            ->where('subjects.0.year_level', '2nd Year'));
});
