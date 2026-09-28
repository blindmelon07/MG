<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStudentPasswordChanged
{
    /**
     * Students must replace their temporary password before seeing their records.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user('student')?->must_change_password) {
            return to_route('student.password.edit');
        }

        return $next($request);
    }
}
