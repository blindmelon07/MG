<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureTwoFactorEnabled
{
    /**
     * Send staff whose role requires two-factor authentication to set it up
     * before they can reach anything else.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('web');

        if ($user === null || ! $user->requiresTwoFactor() || $user->hasEnabledTwoFactorAuthentication()) {
            return $next($request);
        }

        $message = __('Your role requires two-factor authentication. Set it up to continue.');

        if ($request->expectsJson()) {
            abort(403, $message);
        }

        Inertia::flash('toast', ['type' => 'warning', 'message' => $message]);

        return to_route('security.edit');
    }
}
