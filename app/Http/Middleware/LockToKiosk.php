<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * On a kiosk PC (KIOSK_MODE=true), only the kiosk can be opened: anything
 * else, such as the staff login or the admin pages, is "not found" even if
 * someone types its address.
 */
class LockToKiosk
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('kiosk.mode')) {
            return $next($request);
        }

        $name = $request->route()?->getName();

        if ($name === null || ! Str::is(config('kiosk.routes'), $name)) {
            abort(404);
        }

        // Students on the kiosk always get the shared-screen sign-in: no
        // "remember me", and they're signed out after a short idle time.
        if (Str::is('student.login*', $name)) {
            $request->merge(['kiosk' => 1]);
            $request->query->set('kiosk', '1');
        }

        return $next($request);
    }
}
