<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Login Alerts
    |--------------------------------------------------------------------------
    |
    | Every staff and student account is texted (and staff are also emailed)
    | when someone signs in to it or fails to. Failed-attempt alerts are sent
    | at most once per cooldown so a password-guessing attack can't flood the
    | owner's phone. Times in the alerts are shown in the campus timezone.
    |
    */

    'login_alerts' => [
        'enabled' => (bool) env('LOGIN_ALERTS_ENABLED', true),
        'on_success' => (bool) env('LOGIN_ALERTS_ON_SUCCESS', true),
        'failed_cooldown_minutes' => (int) env('LOGIN_ALERTS_FAILED_COOLDOWN', 15),
        'timezone' => env('LOGIN_ALERTS_TIMEZONE', 'Asia/Manila'),
    ],

];
