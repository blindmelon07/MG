<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStudentRequest;
use App\Http\Requests\Admin\UpdateStudentRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Services\StudentCredentials;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class StudentController extends Controller
{
    /** Student columns that don't change from one school year to the next. */
    private const PROFILE = ['name', 'student_number', 'phone_number', 'status'];

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $year = SchoolYear::selected();
        // Students enrolled in the year being viewed, or the ones who aren't (yet).
        $enrollment = $request->string('enrollment')->toString() === 'none' ? 'none' : 'enrolled';
        $inYear = fn (Builder|HasMany $query) => $query->where('school_year', $year);

        return Inertia::render('admin/students/index', [
            'students' => Student::with(['guardians', 'enrollments' => fn ($query) => $inYear($query)->with('course:id,code,name')])
                ->when(
                    $enrollment === 'enrolled',
                    fn (Builder $query) => $query->whereHas('enrollments', $inYear),
                    fn (Builder $query) => $query->whereDoesntHave('enrollments', $inYear),
                )
                ->when($search !== '', function (Builder $query) use ($search): void {
                    $query->where(fn (Builder $query) => $query->where('name', 'like', "%{$search}%")
                        ->orWhere('student_number', 'like', "%{$search}%"));
                })
                ->orderBy('name')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Student $student) => [
                    ...collect($student->toArray())->except('enrollments')->all(),
                    'has_password' => $student->password !== null,
                    'enrollment' => $student->enrollments->first(),
                ]),
            'search' => $search,
            'enrollment' => $enrollment,
            'counts' => [
                'enrolled' => Student::whereHas('enrollments', $inYear)->count(),
                'none' => Student::whereDoesntHave('enrollments', $inYear)->count(),
            ],
            'sections' => Student::whereNotNull('section')->distinct()->orderBy('section')->pluck('section'),
            // Per section, so the login-slips dialog can show the count for the section picked.
            'awaitingCredentials' => Student::active()
                ->awaitingCredentials()
                ->selectRaw('section, count(*) as total')
                ->groupBy('section')
                ->pluck('total', 'section')
                ->map(fn ($total) => (int) $total),
            'educationLevels' => Student::educationLevelOptions(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/students/create', $this->formOptions());
    }

    public function store(StoreStudentRequest $request, StudentCredentials $credentials): RedirectResponse
    {
        $year = SchoolYear::selected();

        $student = Student::admit(
            $request->safe()->only(self::PROFILE),
            $request->placement(),
            $request->validated('guardians'),
            $year,
        );

        if ($request->boolean('send_credentials')) {
            $password = $student->issueTemporaryPassword();
            $texted = $credentials->text($student, $password);
            $credentials->flash($request, $student, $password, ['sms_recipients' => $texted]);

            Log::info('Student credentials issued', [
                'user_id' => $request->user('web')?->id,
                'ip' => $request->ip(),
                'student_ids' => [$student->id],
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student added to S.Y. :year.', ['year' => $year])]);

        return to_route('admin.students.index');
    }

    public function edit(Student $student): Response
    {
        $year = SchoolYear::selected();
        $enrollment = $student->enrollmentFor($year);
        // Not enrolled in this year yet: start from where they were last.
        $placement = $enrollment ?? $student->enrollments()->orderByDesc('school_year')->first() ?? $student;

        return Inertia::render('admin/students/edit', [
            'student' => $student->load('guardians'),
            'placement' => $placement->only(Enrollment::PLACEMENT),
            'enrolled' => $enrollment !== null,
            'history' => $student->enrollments()
                ->with('course:id,code')
                ->orderByDesc('school_year')
                ->get(['id', 'school_year', 'education_level', 'grade_level', 'course_id', 'section']),
            ...$this->formOptions(),
        ]);
    }

    public function update(UpdateStudentRequest $request, Student $student): RedirectResponse
    {
        $year = SchoolYear::selected();
        $guardians = $request->validated('guardians');

        DB::transaction(function () use ($request, $student, $year, $guardians): void {
            $student->update($request->safe()->only(self::PROFILE));
            $student->enroll($year, $request->placement());

            $submittedIds = array_filter(array_column($guardians, 'id'));
            $student->guardians()->whereNotIn('id', $submittedIds)->delete();

            foreach ($guardians as $guardian) {
                $values = [
                    'name' => $guardian['name'],
                    'relationship' => $guardian['relationship'],
                    'phone_number' => $guardian['phone_number'],
                ];

                if (! empty($guardian['id'])) {
                    $student->guardians()->whereKey($guardian['id'])->update($values);
                } else {
                    $student->guardians()->create($values);
                }
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student updated.')]);

        return to_route('admin.students.index');
    }

    public function destroy(Student $student): RedirectResponse
    {
        $student->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student deleted.')]);

        return to_route('admin.students.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'educationLevels' => Student::educationLevelOptions(),
            'courses' => Course::orderBy('code')->get(['id', 'code', 'name', 'education_level']),
            'sectionOptions' => Section::orderBy('name')->get(['id', 'education_level', 'grade_level', 'course_id', 'name']),
        ];
    }
}
