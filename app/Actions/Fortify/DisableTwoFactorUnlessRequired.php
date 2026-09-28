<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;

class DisableTwoFactorUnlessRequired extends DisableTwoFactorAuthentication
{
    /**
     * Staff whose role requires two-factor authentication can't switch it off
     * themselves; a super admin can reset it from the Users page instead.
     *
     * Fortify also calls this to discard a setup that was started but never
     * confirmed, which is still allowed: only a working setup is protected.
     *
     * @param  mixed  $user
     */
    public function __invoke($user): void
    {
        if ($user instanceof User && $user->requiresTwoFactor() && $user->hasEnabledTwoFactorAuthentication()) {
            throw ValidationException::withMessages([
                'two_factor' => __('Two-factor authentication is required for your role and can\'t be turned off.'),
            ]);
        }

        parent::__invoke($user);
    }
}
