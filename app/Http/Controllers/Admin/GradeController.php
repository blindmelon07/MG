<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeachingAssignment;
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

        // Opens on the school year being viewed; "all" lists every year.
        $schoolYear = $request->string('school_year', SchoolYear::selected())->trim()->toString();

        $filters = [
            'search' => $request->string('search')->trim()->toString(),
            'school_year' => $schoolYear === 'all' ? '' : $schoolYear,
            'section' => $request->string('section')->trim()->toString(),
            'subject' => $request->string('subject')->trim()->toString(),
        ];

        $visible = Grade::query()->visibleTo($user);

        $grades = (clone $visible)
            ->with('student:id,name,student_number,grade_level,section')
            ->when($filters['search'] !== '', fn (Builder $query) => $query->whereHas('student', function (Builder $query) use ($filters): void {
                $query->where(fn (Builder $query) => $query->where('name', 'like', "%{$filters['search']}%")
                    ->orWhere('student_number', 'like', "%{$filters['search']}%"));
            }))
            ->when($filters['school_year'] !== '', fn (Builder $query) => $query->where('school_year', $filters['school_year']))
            ->when($filters['subject'] !== '', fn (Builder $query) => $query->where('subject', $filters['subject']))
            ->when($filters['section'] !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereHas('student.enrollments', fn (Builder $q) => $q->where('section', $filters['section'])->whereColumn('enrollments.school_year', 'grades.school_year'))
                ->orWhere(fn (Builder $query) => $query
                    ->whereDoesntHave('student.enrollments', fn (Builder $q) => $q->whereColumn('enrollments.school_year', 'grades.school_year'))
                    ->whereHas('student', fn (Builder $q) => $q->where('section', $filters['section'])))))
            ->orderByDesc('school_year')
            ->orderBy('subject')
            ->orderBy(Student::select('name')->whereColumn('students.id', 'grades.student_id'))
            ->paginate(25)
            ->withQueryString();

        // Show the section each student was in that year, not their current one.
        $sections = Enrollment::whereIn('student_id', $grades->getCollection()->pluck('student_id')->unique())
            ->whereIn('school_year', $grades->getCollection()->pluck('school_year')->unique())
            ->get(['student_id', 'school_year', 'section'])
            ->keyBy(fn (Enrollment $enrollment) => $enrollment->student_id.'|'.$enrollment->school_year);

        $grades->through(fn (Grade $grade) => [
            ...$grade->toArray(),
            'section' => $sections->get($grade->student_id.'|'.$grade->school_year)?->section ?? $grade->student->section,
        ]);

        return Inertia::render('admin/grades/index', [
            'grades' => $grades,
            'filters' => $filters,
            'options' => [
                'schoolYears' => (clone $visible)->distinct()->pluck('school_year')->merge(SchoolYear::names())->unique()->sortDesc()->values(),
                'subjects' => (clone $visible)->distinct()->orderBy('subject')->pluck('subject'),
            ],
            // For staff picking a class to download a pre-filled template.
            'templateOptions' => $user->canManageAllGrades() ? [
                'educationLevels' => Student::educationLevelOptions(),
                'courses' => Course::orderBy('code')->get(['id', 'code', 'name', 'education_level']),
                'sections' => Section::orderBy('name')->get(['id', 'education_level', 'grade_level', 'course_id', 'name']),
                'subjects' => Subject::orderBy('name')->get(['id', 'name', 'education_level']),
            ] : null,
            'canManageAll' => $user->canManageAllGrades(),
            'assignments' => $user->canManageAllGrades()
                ? []
                : $user->teachingAssignments()
                    ->orderByDesc('school_year')
                    ->orderBy('subject')
                    ->get(['id', 'education_level', 'subject', 'section', 'school_year'])
                    ->map(fn (TeachingAssignment $assignment) => [
                        ...$assignment->only(['id', 'subject', 'section', 'school_year']),
                        // null for older assignments saved without a level; their class list can be either system
                        'grading_system' => $assignment->education_level
                            ? Student::gradingSystemFor($assignment->education_level)
                            : null,
                    ]),
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
