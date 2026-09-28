<?php

use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\Http;

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

test('login slips cover students awaiting a password and skip those who set their own', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $new = Student::factory()->create(['name' => 'New Student', 'section' => 'St. Thomas']);
    $settled = Student::factory()->create(['name' => 'Settled Student', 'section' => 'St. Thomas']);
    $settled->password = 'my-own-password';
    $settled->must_change_password = false;
    $settled->save();
    Student::factory()->create(['name' => 'Other Section', 'section' => 'St. Peter']);

    $response = $this->actingAs($registrar)
        ->post(route('admin.students.credentials.batch'), ['section' => 'St. Thomas']);

    $response->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('no-store');

    $csv = $response->streamedContent();
    expect($csv)->toContain('New Student')
        ->not->toContain('Settled Student')
        ->not->toContain('Other Section')
        ->and($new->fresh()->hasAccount())->toBeTrue()
        ->and(password_verify('my-own-password', (string) $settled->fresh()->password))->toBeTrue();
});

test('exported names cannot inject spreadsheet formulas', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['name' => '=HYPERLINK("http://evil.test","Click")']);

    $csv = $this->actingAs($registrar)
        ->post(route('admin.students.credentials.batch'))
        ->streamedContent();

    expect($csv)->toContain("'=HYPERLINK")
        ->not->toContain(',=HYPERLINK')
        ->not->toContain(',"=HYPERLINK');
});

test('teachers cannot issue student passwords', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);
    $student = Student::factory()->create();

    $this->actingAs($teacher)->post(route('admin.students.credentials.store', $student))->assertForbidden();
    $this->actingAs($teacher)->post(route('admin.students.credentials.batch'))->assertForbidden();
});
