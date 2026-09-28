<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Student\Concerns\RendersPortalPages;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    use RendersPortalPages;

    public function create(Request $request): Response
    {
        return $this->portal('login', kiosk: $request->boolean('kiosk'));
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'student_number' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        $kiosk = $request->boolean('kiosk');

        $authenticated = Auth::guard('student')->attempt([
            'student_number' => trim($credentials['student_number']),
            'password' => $credentials['password'],
            'status' => 'active',
        ], remember: ! $kiosk && $request->boolean('remember'));

        if (! $authenticated) {
            throw ValidationException::withMessages([
                'student_number' => __('auth.failed'),
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put([
            'student_kiosk' => $kiosk,
            'student_signed_in_at' => now()->getTimestamp(),
            'student_last_activity' => now()->getTimestamp(),
        ]);

        $student = Auth::guard('student')->user();
        $student->forceFill(['last_login_at' => now()])->save();

        return to_route('student.grades');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $kiosk = (bool) $request->session()->get('student_kiosk', false);

        Auth::guard('student')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Drops the key that decrypts earlier history entries.
        Inertia::clearHistory();

        return $kiosk ? to_route('home') : to_route('student.login');
    }
}
