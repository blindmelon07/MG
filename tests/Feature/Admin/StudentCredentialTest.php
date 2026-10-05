<?php

use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\View;

test('registrar can issue a temporary password that is shown once', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);

    $response = $this->actingAs($registrar)->post(route('admin.students.credentials.store', $student));

    $response->assertRedirect();
    $response->assertInertiaFlash('credentials.student_number', 'LRN-0001');

    $student->refresh();
    expect($student->hasAccount())->toBeTrue()
        ->and($student->must_change_password)->toBeTrue()
        ->and(password_verify('LRN-0001', (string) $student->password))->toBeFalse();
});

test('the temporary password can be texted to the first guardian', function () {
    Http::fake(['*' => Http::response(['ok' => true])]);

    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001']);
    Guardian::factory()->for($student)->create(['phone_number' => '09171234567']);

    $this->actingAs($registrar)
        ->post(route('admin.students.credentials.store', $student), ['send_sms' => '1'])
        ->assertInertiaFlash('credentials.sms_sent', true);

    Http::assertSent(fn ($request) => str_contains($request['message'], 'LRN-0001')
        && $request['recipient'] === '639171234567');
});

/**
 * Capture the slips handed to the PDF view; the PDF itself is compressed.
 *
 * @return ArrayObject<int, mixed>
 */
function captureLoginSlips(): ArrayObject
{
    $captured = new ArrayObject;

    View::composer('pdf.login-slips', function ($view) use ($captured): void {
        $captured->exchangeArray($view->getData());
    });

    return $captured;
}

test('login slips cover students awaiting a password and skip those who set their own', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $captured = captureLoginSlips();

    $new = Student::factory()->create(['name' => 'New Student', 'section' => 'St. Thomas']);
    $settled = Student::factory()->create(['name' => 'Settled Student', 'section' => 'St. Thomas']);
    $settled->password = 'my-own-password';
    $settled->must_change_password = false;
    $settled->save();
    Student::factory()->create(['name' => 'Other Section', 'section' => 'St. Peter']);

    $response = $this->actingAs($registrar)
        ->post(route('admin.students.credentials.batch'), ['section' => 'St. Thomas']);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    expect($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($response->getContent())->toStartWith('%PDF');

    $names = array_column($captured['slips'], 'name');
    expect($names)->toBe(['New Student'])
        ->and($captured['perPage'])->toBe(4)
        ->and($captured['school']['name'])->toBe(config('school.name'))
        ->and($new->fresh()->hasAccount())->toBeTrue()
        ->and(password_verify('my-own-password', (string) $settled->fresh()->password))->toBeTrue();
});

test('a single student slip can be downloaded right after issuing the password', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    $student = Student::factory()->create(['student_number' => 'LRN-0001', 'education_level' => 'jhs', 'grade_level' => 'Grade 8']);
    $captured = captureLoginSlips();

    $this->actingAs($registrar)->post(route('admin.students.credentials.store', $student));

    // The slip link travels in the Inertia flash data, alongside the password.
    $slipUrl = collect(session()->all())->flatten()
        ->first(fn ($value) => is_string($value) && str_contains($value, '/credentials/slip/'));
    expect($slipUrl)->not->toBeNull();

    $response = $this->actingAs($registrar)->get($slipUrl);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    expect($captured['perPage'])->toBe(1)
        ->and($captured['slips'][0]['student_number'])->toBe('LRN-0001')
        ->and($captured['slips'][0]['education_level'])->toBe('Junior High School')
        ->and(password_verify($captured['slips'][0]['password'], (string) $student->fresh()->password))->toBeTrue();
});

test('an unknown login slip token is not found', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($registrar)
        ->get(route('admin.students.credentials.slip', str_repeat('a', 40)))
        ->assertNotFound();
});

test('teachers cannot issue student passwords', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $student = Student::factory()->create();

    $this->actingAs($teacher)->post(route('admin.students.credentials.store', $student))->assertForbidden();
    $this->actingAs($teacher)->post(route('admin.students.credentials.batch'))->assertForbidden();
});
