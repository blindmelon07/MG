<?php

use App\Jobs\SendSmsJob;
use App\Models\Student;
use App\Models\User;
use App\Notifications\LoginAlert;
use App\Support\LoginAttempt;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Features;

beforeEach(function () {
    Queue::fake([SendSmsJob::class]);
    Notification::fake();
});

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

test('staff are emailed and texted when they sign in', function () {
    $user = User::factory()->create(['phone_number' => '09171234567']);

    $this->withHeader('User-Agent', BROWSER)->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    Notification::assertSentTo($user, LoginAlert::class, fn (LoginAlert $alert) => $alert->attempt->outcome === LoginAttempt::SUCCEEDED
        && $alert->attempt->device === 'Chrome on Windows');
    Queue::assertPushed(SendSmsJob::class, fn (SendSmsJob $job) => $job->recipient === '09171234567'
        && str_contains($job->message, 'New sign-in')
        && str_contains($job->message, 'Chrome on Windows')
        && ! str_contains($job->message, 'http'));
});

test('staff without a phone number are only emailed', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    Notification::assertSentTo($user, LoginAlert::class);
    Queue::assertNotPushed(SendSmsJob::class);
});

test('a wrong password alerts the account once per cooldown', function () {
    $user = User::factory()->create(['phone_number' => '09171234567']);

    foreach (range(1, 3) as $try) {
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong-password']);
    }

    $this->assertGuest();
    Notification::assertSentToTimes($user, LoginAlert::class, 1);
    Notification::assertSentTo($user, LoginAlert::class, fn (LoginAlert $alert) => $alert->attempt->outcome === LoginAttempt::FAILED);
    Queue::assertPushed(SendSmsJob::class, 1);
    Queue::assertPushed(SendSmsJob::class, fn (SendSmsJob $job) => str_contains($job->message, 'Failed sign-in attempt'));
});

test('unknown emails alert no one', function () {
    $this->post(route('login.store'), ['email' => 'nobody@example.com', 'password' => 'password']);

    Notification::assertNothingSent();
    Queue::assertNothingPushed();
});

test('a correct password with a wrong two-factor code sends an urgent alert', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    $user = User::factory()->withTwoFactor()->create([
        'phone_number' => '09171234567',
        'two_factor_secret' => encrypt(app(TwoFactorAuthenticationProvider::class)->generateSecretKey()),
    ]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));

    // Not signed in yet: no alert until the code is checked.
    Notification::assertNothingSent();

    $this->post(route('two-factor.login.store'), ['code' => '000000']);

    $this->assertGuest();
    Notification::assertSentTo($user, LoginAlert::class, fn (LoginAlert $alert) => $alert->attempt->outcome === LoginAttempt::TWO_FACTOR_FAILED);
    Queue::assertPushed(SendSmsJob::class, fn (SendSmsJob $job) => str_contains($job->message, 'wrong 2FA code'));
});

test('students are texted when they sign in and when a password is wrong', function () {
    $student = Student::factory()->create(['student_number' => 'LRN-0001', 'phone_number' => '09181234567']);
    $password = $student->issueTemporaryPassword();

    $this->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => 'wrong-password']);
    $this->post(route('student.login.store'), ['student_number' => 'LRN-0001', 'password' => $password]);

    $this->assertAuthenticatedAs($student, 'student');
    Queue::assertPushed(SendSmsJob::class, 2);
    Queue::assertPushed(SendSmsJob::class, fn (SendSmsJob $job) => $job->recipient === '09181234567'
        && str_contains($job->message, 'Failed sign-in attempt on your account LRN-0001'));
    Queue::assertPushed(SendSmsJob::class, fn (SendSmsJob $job) => str_contains($job->message, 'New sign-in to your account LRN-0001'));
});

test('alerts can be turned off', function () {
    config(['security.login_alerts.enabled' => false]);
    $user = User::factory()->create(['phone_number' => '09171234567']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    Notification::assertNothingSent();
    Queue::assertNothingPushed();
});

test('the alert email names the device and links to account security', function () {
    $user = User::factory()->create();
    $attempt = new LoginAttempt(LoginAttempt::FAILED, now(), '203.0.113.5', 'Safari on iOS');

    $mail = (new LoginAlert($attempt))->toMail($user);

    expect($mail->subject)->toContain('Failed sign-in attempt')
        ->and(implode(' ', $mail->introLines))->toContain('Safari on iOS')->toContain('203.0.113.5')
        ->and($mail->actionUrl)->toBe(route('security.edit'));
});
