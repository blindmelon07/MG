<?php

namespace App\Listeners;

use App\Jobs\SendSmsJob;
use App\Models\Student;
use App\Models\User;
use App\Notifications\LoginAlert;
use App\Support\LoginAttempt;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

/**
 * Tells account owners, by text and (for staff) email, when someone signs in
 * to their account or fails to.
 */
class SendLoginAlerts
{
    public function __construct(private Request $request) {}

    public function handleLogin(Login $event): void
    {
        // A "remember me" cookie restoring a session isn't a new sign-in.
        if (! config('security.login_alerts.on_success') || Auth::guard($event->guard)->viaRemember()) {
            return;
        }

        $this->alert($event->user, LoginAttempt::SUCCEEDED);
    }

    /**
     * A wrong password for an account that exists. Unknown usernames and
     * inactive students have no account to alert.
     */
    public function handleFailed(Failed $event): void
    {
        if ($event->user !== null && $this->firstInCooldown($event->user, LoginAttempt::FAILED)) {
            $this->alert($event->user, LoginAttempt::FAILED);
        }
    }

    public function handleTwoFactorFailed(TwoFactorAuthenticationFailed $event): void
    {
        if ($this->firstInCooldown($event->user, LoginAttempt::TWO_FACTOR_FAILED)) {
            $this->alert($event->user, LoginAttempt::TWO_FACTOR_FAILED);
        }
    }

    private function alert(Authenticatable $account, string $outcome): void
    {
        if (! config('security.login_alerts.enabled')) {
            return;
        }

        $attempt = LoginAttempt::from($this->request, $outcome);

        if ($account instanceof User) {
            $account->notify(new LoginAlert($attempt));
        }

        $phone = match (true) {
            $account instanceof User, $account instanceof Student => $account->phone_number,
            default => null,
        };

        if ($phone !== null && trim($phone) !== '') {
            SendSmsJob::dispatch($phone, $this->smsMessage($account, $attempt));
        }
    }

    /**
     * Failed-attempt alerts go out once per cooldown, so repeated guesses
     * don't flood the owner with texts.
     */
    private function firstInCooldown(Authenticatable $account, string $outcome): bool
    {
        $key = 'login-alert:'.$outcome.':'.$account::class.':'.$account->getAuthIdentifier();

        return Cache::add($key, true, now()->addMinutes(config('security.login_alerts.failed_cooldown_minutes')));
    }

    /**
     * No link in the text: PH networks drop SMS that contain URLs.
     */
    private function smsMessage(Authenticatable $account, LoginAttempt $attempt): string
    {
        $app = config('app.name');
        $who = $account instanceof Student && $account->student_number !== null
            ? "account {$account->student_number}"
            : 'account';
        $where = "{$attempt->time()}, {$attempt->device}".($attempt->ip !== null ? ", IP {$attempt->ip}" : '');

        return match ($attempt->outcome) {
            LoginAttempt::SUCCEEDED => "{$app} Security: New sign-in to your {$who} on {$where}. Not you? Change your password now and tell the school admin.",
            LoginAttempt::TWO_FACTOR_FAILED => "{$app} Security: Someone entered your correct password but a wrong 2FA code on {$where}. Not you? Change your password now.",
            default => "{$app} Security: Failed sign-in attempt on your {$who} on {$where}. If this keeps happening, tell the school admin.",
        };
    }
}
