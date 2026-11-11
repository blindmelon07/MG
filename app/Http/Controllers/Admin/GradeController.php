<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Advisory;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Notifications\GradesReturned;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
            'status' => in_array($status = $request->string('status')->toString(), ['pending', 'returned', 'posted'], true) ? $status : '',
        ];

        $visible = Grade::query()->visibleTo($user);

        $grades = $this->filtered(clone $visible, $filters)
            ->with('student:id,name,student_number,grade_level,section')
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
            'pendingCount' => (clone $visible)->pendingApproval()->count(),
            'returnedCount' => (clone $visible)->returned()->count(),
            'canApprove' => $user->canManageAllGrades(),
            'pendingSubjects' => $user->canManageAllGrades() ? $this->pendingSubjects() : [],
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
            // Sections the teacher advises: any subject, for the section's students.
            'advisories' => $user->canManageAllGrades()
                ? []
                : $user->advisories()
                    ->orderByDesc('school_year')
                    ->get(['id', 'education_level', 'grade_level', 'section', 'school_year'])
                    ->map(fn (Advisory $advisory) => [
                        ...$advisory->only(['id', 'grade_level', 'section', 'school_year']),
                        'grading_system' => Student::gradingSystemFor($advisory->education_level),
                    ]),
        ]);
    }

    /**
     * Post a subject's pending college grades for students to see, all at
     * once: one approval per subject, never student by student.
     */
    public function approve(Request $request): RedirectResponse
    {
        $grades = $this->pendingSubject($request, $this->subjectRules());

        DB::transaction(fn () => $grades->each(fn (Grade $grade) => $grade->approve($request->user('web'))));

        Inertia::flash('toast', $grades->isNotEmpty()
            ? ['type' => 'success', 'message' => trans_choice(':subject approved: :count grade posted to students.|:subject approved: :count grades posted to students.', $grades->count(), ['subject' => $grades->first()->subject])]
            : ['type' => 'info', 'message' => __('No grades were waiting for approval.')]);

        return back();
    }

    /**
     * Send a subject's pending college grades back to the teacher who
     * uploaded them, with the reason, instead of posting them. The teacher
     * is emailed.
     */
    public function returnToTeacher(Request $request): RedirectResponse
    {
        $registrar = $request->user('web');
        $grades = $this->pendingSubject($request, [
            ...$this->subjectRules(),
            'reason' => ['required', 'string', 'max:255'],
        ], ['reason.required' => __('Tell the teacher what to correct.')]);
        $reason = trim($request->string('reason')->toString());

        DB::transaction(fn () => $grades->each(fn (Grade $grade) => $grade->returnToTeacher($registrar, $reason)));

        $teacher = $grades->first()?->encoded_by ? User::find($grades->first()->encoded_by) : null;
        $teacher?->notify(new GradesReturned($grades->count(), [$grades->first()->subject], $reason, $registrar->name));

        Inertia::flash('toast', $grades->isNotEmpty()
            ? ['type' => 'success', 'message' => trans_choice(':subject returned to the teacher (:count grade).|:subject returned to the teacher (:count grades).', $grades->count(), ['subject' => $grades->first()->subject])]
            : ['type' => 'info', 'message' => __('No grades were waiting for approval.')]);

        return back();
    }

    /**
     * What identifies one subject's batch of pending grades: the class a
     * teacher uploaded for a term.
     *
     * @return array<string, array<int, string>>
     */
    private function subjectRules(): array
    {
        return [
            'school_year' => ['required', 'string', 'max:9'],
            'term' => ['nullable', 'string', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'encoded_by' => ['nullable', 'integer'],
        ];
    }

    /**
     * Every pending grade in the subject the request names.
     *
     * @param  array<string, array<int, string>>  $rules
     * @param  array<string, string>  $messages
     * @return Collection<int, Grade>
     */
    private function pendingSubject(Request $request, array $rules, array $messages = []): Collection
    {
        $data = $request->validate($rules, $messages);

        // where() with null matches NULL, for grades saved without a term or uploader.
        return Grade::pendingApproval()
            ->where('school_year', $data['school_year'])
            ->where('term', $data['term'] ?? null)
            ->where('subject', $data['subject'])
            ->where('encoded_by', $data['encoded_by'] ?? null)
            ->get();
    }

    /**
     * The registrar's approval queue: pending college grades grouped by
     * subject, each approved or returned as one.
     *
     * @return list<array<string, mixed>>
     */
    private function pendingSubjects(): array
    {
        $grades = Grade::pendingApproval()
            ->with(['student:id,section', 'encoder:id,name'])
            ->get(['id', 'student_id', 'school_year', 'term', 'subject_code', 'subject', 'encoded_by']);

        // The section each student was in that year, not their current one.
        $sections = Enrollment::whereIn('student_id', $grades->pluck('student_id')->unique())
            ->get(['student_id', 'school_year', 'section'])
            ->keyBy(fn (Enrollment $enrollment) => $enrollment->student_id.'|'.$enrollment->school_year);

        return $grades
            ->groupBy(fn (Grade $grade) => implode('|', [$grade->school_year, $grade->term, $grade->subject, $grade->encoded_by]))
            ->map(function (Collection $subjectGrades) use ($sections): array {
                $grade = $subjectGrades->first();

                return [
                    'school_year' => $grade->school_year,
                    'term' => $grade->term,
                    'subject' => $grade->subject,
                    'subject_code' => $subjectGrades->pluck('subject_code')->filter()->first(),
                    'encoded_by' => $grade->encoded_by,
                    'teacher' => $grade->encoder?->name,
                    'count' => $subjectGrades->count(),
                    'sections' => $subjectGrades
                        ->map(fn (Grade $grade) => $sections->get($grade->student_id.'|'.$grade->school_year)?->section ?? $grade->student?->section)
                        ->filter()->unique()->sort()->values()->all(),
                ];
            })
            ->sortBy([['school_year', 'desc'], ['subject', 'asc'], ['term', 'asc']])
            ->values()
            ->all();
    }

    /**
     * @param  Builder<Grade>  $query
     * @param  array{search: string, school_year: string, section: string, subject: string, status: string}  $filters
     * @return Builder<Grade>
     */
    private function filtered(Builder $query, array $filters): Builder
    {
        return $query
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
            ->when($filters['status'] === 'pending', fn (Builder $query) => $query->pendingApproval())
            ->when($filters['status'] === 'returned', fn (Builder $query) => $query->returned())
            ->when($filters['status'] === 'posted', fn (Builder $query) => $query->posted());
    }

    public function destroy(Request $request, Grade $grade): RedirectResponse
    {
        $user = $request->user('web');

        abort_unless($grade->isVisibleTo($user), 403);

        // Teachers can't take back a college grade the registrar has posted.
        if (Grade::needsApproval($grade->grading_system, $user) && $grade->isPosted()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This grade is already posted. Ask the registrar to change or remove it.')]);

            return back();
        }

        $grade->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Grade deleted.')]);

        return back();
    }
}
