<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class SecureStudentSession
{
    /** Server-side backstop for the kiosk's on-screen idle timer. */
    public const KIOSK_IDLE_SECONDS = 180;

    /** Kiosk sessions end after this long no matter what. */
    public const KIOSK_MAX_SECONDS = 900;

    /**
     * Protect signed-in student pages, which are often viewed on a shared kiosk.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->kioskSessionExpired($request)) {
            Auth::guard('student')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            Inertia::clearHistory();
            Inertia::flash('toast', ['type' => 'info', 'message' => __('You were signed out for inactivity.')]);

            return to_route('home');
        }

        $request->session()->put('student_last_activity', now()->getTimestamp());

        // Keep grades out of the browser's history (needs HTTPS to take effect)
        // and out of any cache, so the Back button can't reveal them later.
        Inertia::encryptHistory();

        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, private, max-age=0');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }

    private function kioskSessionExpired(Request $request): bool
    {
        $session = $request->session();

        if (! $session->get('student_kiosk', false)) {
            return false;
        }

        $now = now()->getTimestamp();
        $lastActivity = (int) $session->get('student_last_activity', $now);
        $signedInAt = (int) $session->get('student_signed_in_at', $now);

        return $now - $lastActivity > self::KIOSK_IDLE_SECONDS
            || $now - $signedInAt > self::KIOSK_MAX_SECONDS;
    }
}
