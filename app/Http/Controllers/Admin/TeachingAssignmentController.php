<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeachingAssignmentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/teaching-assignments/index', [
            'assignments' => TeachingAssignment::with('teacher:id,name')
                ->orderByDesc('school_year')
                ->orderBy('section')
                ->orderBy('subject')
                ->get(),
            'teachers' => User::where('role', 'teacher')->orderBy('name')->get(['id', 'name']),
            'sections' => Student::whereNotNull('section')->distinct()->orderBy('section')->pluck('section'),
            'subjects' => Subject::distinct()->orderBy('name')->pluck('name'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('role', 'teacher')],
            'subject' => ['required', 'string', 'max:255'],
            'section' => ['required', 'string', 'max:255'],
            'school_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
        ], [
            'user_id.exists' => __('Choose a user with the teacher role.'),
            'school_year.regex' => __('School year must look like 2026-2027.'),
        ]);

        $data = array_map(fn ($value) => is_string($value) ? trim($value) : $value, $data);

        $exists = TeachingAssignment::where($data)->exists();

        if (! $exists) {
            TeachingAssignment::create($data);
        }

        Inertia::flash('toast', [
            'type' => $exists ? 'info' : 'success',
            'message' => $exists ? __('That teacher is already assigned to this class.') : __('Teaching assignment added.'),
        ]);

        return to_route('admin.teaching-assignments.index');
    }

    public function destroy(TeachingAssignment $teachingAssignment): RedirectResponse
    {
        $teachingAssignment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Teaching assignment removed.')]);

        return to_route('admin.teaching-assignments.index');
    }
}
