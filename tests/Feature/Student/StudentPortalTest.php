<?php

use App\Http\Middleware\SecureStudentSession;
use App\Models\Grade;
use App\Models\Student;
use App\Models\User;

function studentWithPassword(array $attributes = [], bool $changed = true): Student
{
    $student = Student::factory()->create($attributes);
    $student->password = 'correct-horse-9';
    $student->must_change_password = ! $changed;
    $student->save();

    return $student;
}

test('new students cannot sign in until the registrar issues a password', function () {
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    expect($student->hasAccount())->toBeFalse();

    $this->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'LRN-0001'])
        ->assertSessionHasErrors('student_number');
    $this->assertGuest('student');
});

test('temporary passwords are random and never the student number', function () {
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    $first = $student->issueTemporaryPassword();
    $second = $student->issueTemporaryPassword();

    expect($first)->toHaveLength(10)
        ->not->toBe('LRN-0001')
        ->not->toBe($second)
        ->and(password_verify($second, (string) $student->fresh()->password))->toBeTrue()
        ->and($student->fresh()->must_change_password)->toBeTrue();
});

test('a student signs in with a temporary password and must change it first', function () {
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);
    $password = $student->issueTemporaryPassword();

    $this->post(route('student.login.store'), [
        'student_number' => 'LRN-0001',
        'password' => $password,
    ])->assertRedirect(route('student.grades'));

    $this->assertAuthenticated('student');
    $this->assertGuest('web');

    $this->get(route('student.grades'))->assertRedirect(route('student.password.edit'));
});

test('changing the password unlocks the grades page', function () {
    $student = Student::factory()->create();
    $temporary = $student->issueTemporaryPassword();

    $this->actingAs($student, 'student')->put(route('student.password.update'), [
        'current_password' => $temporary,
        'password' => 'new-secret-123',
        'password_confirmation' => 'new-secret-123',
    ])->assertRedirect(route('student.grades'));

    expect($student->fresh()->must_change_password)->toBeFalse();

    $this->actingAs($student->fresh(), 'student')->get(route('student.grades'))->assertOk();
});

test('the new password cannot be the student number', function () {
    $student = Student::factory()->create(['student_number' => 'LRN-00012345']);
    $temporary = $student->issueTemporaryPassword();

    $this->actingAs($student, 'student')->put(route('student.password.update'), [
        'current_password' => $temporary,
        'password' => 'LRN-00012345',
        'password_confirmation' => 'LRN-00012345',
    ])->assertSessionHasErrors('password');
});

test('inactive students and wrong passwords cannot sign in', function () {
    studentWithPassword(['student_number' => 'LRN-0001', 'status' => 'inactive']);
    studentWithPassword(['student_number' => 'LRN-0002']);

    $this->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'correct-horse-9'])
        ->assertSessionHasErrors('student_number');
    $this->post(route('student.login.store'), ['student_number' => 'LRN-0002', 'password' => 'wrong'])
        ->assertSessionHasErrors('student_number');

    $this->assertGuest('student');
});

test('sign-in attempts are limited per student number even from different addresses', function () {
    studentWithPassword(['student_number' => 'LRN-0001']);

    foreach (range(1, 20) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$i}"])
            ->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'guess']);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
        ->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'correct-horse-9'])
        ->assertTooManyRequests();
});

test('students see only their own grades grouped by period', function () {
    $student = studentWithPassword();

    Grade::factory()->for($student)->create(['subject' => 'Mathematics', 'final_grade' => 90]);
    Grade::factory()->for($student)->create(['subject' => 'English', 'final_grade' => 80]);
    Grade::factory()->for($student)->create(['school_year' => '2025-2026', 'subject' => 'Science']);
    Grade::factory()->create(['subject' => 'Someone Else']);

    $this->actingAs($student, 'student')->get(route('student.grades'))
        ->assertInertia(fn ($page) => $page
            ->component('student/grades')
            ->has('periods', 2)
            ->where('periods.0.school_year', '2026-2027')
            ->where('periods.0.average', 85)
            ->has('periods.0.grades', 2)
        );
});

test('grade pages are never cached and their history is encrypted', function () {
    $student = studentWithPassword();

    $response = $this->actingAs($student, 'student')->get(route('student.grades'));

    expect($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($response->viewData('page')['encryptHistory'] ?? false)->toBeTrue();
});

test('guests are sent to the student sign-in page', function () {
    $this->get(route('student.grades'))->assertRedirect(route('student.login'));
});

test('kiosk sign-in renders kiosk pages and sign-out returns to the kiosk home', function () {
    studentWithPassword(['student_number' => 'LRN-0001']);

    $this->get(route('student.login', ['kiosk' => 1]))
        ->assertInertia(fn ($page) => $page->component('kiosk/student/login'));

    $this->post(route('student.login.store'), [
        'student_number' => 'LRN-0001',
        'password' => 'correct-horse-9',
        'kiosk' => '1',
    ]);

    $this->get(route('student.grades'))
        ->assertInertia(fn ($page) => $page->component('kiosk/student/grades')->where('kiosk', true));

    $this->post(route('student.logout'))->assertRedirect(route('home'));
    $this->assertGuest('student');
});

test('an idle kiosk session is ended by the server', function () {
    studentWithPassword(['student_number' => 'LRN-0001']);

    $this->post(route('student.login.store'), [
        'student_number' => 'LRN-0001',
        'password' => 'correct-horse-9',
        'kiosk' => '1',
    ]);

    $this->travel(SecureStudentSession::KIOSK_IDLE_SECONDS + 5)->seconds();

    $this->get(route('student.grades'))->assertRedirect(route('home'));
    $this->assertGuest('student');
});

test('a password reset ends the student\'s other sessions', function () {
    $student = studentWithPassword(['student_number' => 'LRN-0001']);

    $this->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'correct-horse-9']);
    $this->get(route('student.grades'))->assertOk();

    $student->issueTemporaryPassword();
    // Each real request loads the student afresh; drop the test client's cached guard.
    $this->app['auth']->forgetGuards();

    $this->get(route('student.grades'))->assertRedirect(route('student.login'));
    $this->assertGuest('student');
});

test('staff cannot use the student portal with their staff session', function () {
    $staff = User::factory()->create();

    $this->actingAs($staff)->get(route('student.grades'))->assertRedirect(route('student.login'));
});
