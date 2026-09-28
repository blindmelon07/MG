<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class UserTwoFactorController extends Controller
{
    /**
     * Clear a staff member's two-factor setup, e.g. after they lose their phone
     * and recovery codes. If their role requires it, they must set it up again
     * before they can use the dashboard.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        Log::info('Two-factor authentication reset by super admin', [
            'user_id' => $user->id,
            'reset_by' => $request->user('web')?->id,
            'ip' => $request->ip(),
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $user->requiresTwoFactor()
                ? __('Two-factor reset. :name must set it up again at their next sign-in.', ['name' => $user->name])
                : __('Two-factor reset for :name.', ['name' => $user->name]),
        ]);

        return back();
    }
}
