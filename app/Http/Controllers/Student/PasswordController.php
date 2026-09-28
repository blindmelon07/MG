<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Student\Concerns\RendersPortalPages;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    use RendersPortalPages;

    public function edit(Request $request): Response
    {
        $student = $request->user('student');

        return $this->portal('password', [
            'mustChange' => $student->must_change_password,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $student = $request->user('student');

        $validated = $request->validate([
            'current_password' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail) use ($student): void {
                if (! Hash::check((string) $value, (string) $student->password)) {
                    $fail(__('The current password is incorrect.'));
                }
            }],
            'password' => ['required', 'string', Password::defaults(), 'confirmed', function (string $attribute, mixed $value, Closure $fail) use ($student): void {
                if ((string) $value === $student->student_number) {
                    $fail(__('Your new password cannot be your student number.'));
                }
            }],
        ]);

        $student->password = $validated['password'];
        $student->must_change_password = false;
        $student->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return to_route('student.grades');
    }
}
