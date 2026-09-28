<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Grade;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GradeController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user('web');

        $filters = [
            'search' => $request->string('search')->trim()->toString(),
            'school_year' => $request->string('school_year')->trim()->toString(),
            'section' => $request->string('section')->trim()->toString(),
            'subject' => $request->string('subject')->trim()->toString(),
        ];

        $visible = Grade::query()->visibleTo($user);

        $grades = (clone $visible)
            ->with('student:id,name,student_number,grade_level,section')
            ->when($filters['search'] !== '', fn (Builder $query) => $query->whereHas('student', function (Builder $query) use ($filters): void {
                $query->where('name', 'like', "%{$filters['search']}%")
                    ->orWhere('student_number', 'like', "%{$filters['search']}%");
            }))
            ->when($filters['school_year'] !== '', fn (Builder $query) => $query->where('school_year', $filters['school_year']))
            ->when($filters['subject'] !== '', fn (Builder $query) => $query->where('subject', $filters['subject']))
            ->when($filters['section'] !== '', fn (Builder $query) => $query->whereHas('student', fn (Builder $q) => $q->where('section', $filters['section'])))
            ->orderByDesc('school_year')
            ->orderBy('subject')
            ->orderBy(Student::select('name')->whereColumn('students.id', 'grades.student_id'))
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('admin/grades/index', [
            'grades' => $grades,
            'filters' => $filters,
            'options' => [
                'schoolYears' => (clone $visible)->distinct()->orderByDesc('school_year')->pluck('school_year'),
                'subjects' => (clone $visible)->distinct()->orderBy('subject')->pluck('subject'),
            ],
            'canManageAll' => $user->canManageAllGrades(),
            'assignments' => $user->canManageAllGrades()
                ? []
                : $user->teachingAssignments()->orderByDesc('school_year')->orderBy('subject')->get(['id', 'subject', 'section', 'school_year']),
        ]);
    }

    public function destroy(Request $request, Grade $grade): RedirectResponse
    {
        abort_unless($grade->isVisibleTo($request->user('web')), 403);

        $grade->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Grade deleted.')]);

        return back();
    }
}
