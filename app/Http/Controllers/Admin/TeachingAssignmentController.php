<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeachingAssignmentController extends Controller
{
    public function index(Request $request): Response
    {
        $level = $request->string('level')->trim()->toString();
        $level = array_key_exists($level, Student::EDUCATION_LEVELS) ? $level : '';
        $year = SchoolYear::selected();

        return Inertia::render('admin/teaching-assignments/index', [
            'assignments' => TeachingAssignment::with('teacher:id,name')
                ->where('school_year', $year)
                ->when($level !== '', fn (Builder $query) => $query->where('education_level', $level))
                ->orderByDesc('school_year')
                ->orderBy('grade_level')
                ->orderBy('section')
                ->orderBy('subject')
                ->get(),
            'level' => $level,
            'levelCounts' => TeachingAssignment::query()
                ->where('school_year', $year)
                ->selectRaw('education_level, count(*) as total')
                ->groupBy('education_level')
                ->pluck('total', 'education_level'),
            'educationLevels' => Student::educationLevelOptions(),
            'teachers' => User::where('role', 'teacher')->orderBy('name')->get(['id', 'name']),
            'sections' => Section::orderBy('name')
                ->get(['education_level', 'grade_level', 'name'])
                ->map(fn (Section $section) => [
                    'education_level' => $section->education_level,
                    'grade_level' => $section->grade_level,
                    'section' => $section->name,
                ]),
            'subjects' => Subject::orderBy('name')->get(['id', 'code', 'name', 'education_level']),
        ]);
    }

    /**
     * A teacher's own classes, read-only.
     */
    public function mine(Request $request): Response
    {
        return Inertia::render('admin/teaching-assignments/mine', [
            'assignments' => $request->user('web')->teachingAssignments()
                ->orderByDesc('school_year')
                ->orderBy('grade_level')
                ->orderBy('section')
                ->orderBy('subject')
                ->get(['id', 'education_level', 'grade_level', 'subject', 'section', 'school_year']),
            'educationLevels' => Student::educationLevelOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $educationLevel = $request->string('education_level')->toString();

        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('role', 'teacher')],
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'grade_level' => ['required', 'string', Rule::in(Student::EDUCATION_LEVELS[$educationLevel]['grade_levels'] ?? [])],
            'subject' => ['required', 'string', 'max:255', Rule::exists('subjects', 'name')->where('education_level', $educationLevel)],
            'section' => ['required', 'string', 'max:255'],
            'school_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
        ], [
            'user_id.exists' => __('Choose a user with the teacher role.'),
            'subject.exists' => __('Choose a subject from the Subjects list for this education level.'),
            'grade_level.in' => __('Choose a year level for this education level.'),
            'school_year.regex' => __('School year must look like 2026-2027.'),
        ]);

        $data = array_map(fn ($value) => is_string($value) ? trim($value) : $value, $data);

        $exists = TeachingAssignment::where('user_id', $data['user_id'])
            ->where('subject', $data['subject'])
            ->where('section', $data['section'])
            ->where('school_year', $data['school_year'])
            ->exists();

        if (! $exists) {
            TeachingAssignment::create($data);
        }

        Inertia::flash('toast', [
            'type' => $exists ? 'info' : 'success',
            'message' => $exists ? __('That teacher is already assigned to this class.') : __('Teaching assignment added.'),
        ]);

        return to_route('admin.teaching-assignments.index', ['level' => $data['education_level']]);
    }

    public function destroy(TeachingAssignment $teachingAssignment): RedirectResponse
    {
        $level = $teachingAssignment->education_level;

        $teachingAssignment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Teaching assignment removed.')]);

        return to_route('admin.teaching-assignments.index', array_filter(['level' => $level]));
    }
}
