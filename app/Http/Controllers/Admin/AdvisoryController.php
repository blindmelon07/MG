<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Advisory;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\SuspensionNotice;
use App\Models\User;
use App\Services\SmsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdvisoryController extends Controller
{
    /**
     * The registrar's list of section advisers for the school year being viewed.
     */
    public function index(Request $request): Response
    {
        $year = SchoolYear::selected();
        [$sort, $direction] = $this->sorting($request, 'sort', 'direction', ['adviser', 'grade_level', 'section', 'notices'], 'grade_level', 'asc');
        [$noticeSort, $noticeDirection] = $this->sorting($request, 'notice_sort', 'notice_direction', ['starts_on', 'section', 'sent_by', 'recipients', 'sent_at'], 'sent_at', 'desc');

        $advisories = Advisory::with('adviser:id,name')
            ->withCount('suspensionNotices')
            ->where('school_year', $year);

        match ($sort) {
            'adviser' => $advisories->orderBy(User::select('name')->whereColumn('users.id', 'advisories.user_id'), $direction),
            'section' => $advisories->orderBy('section', $direction),
            'notices' => $advisories->orderBy('suspension_notices_count', $direction),
            default => $this->orderByGradeLevel($advisories, $direction),
        };

        $notices = SuspensionNotice::where('school_year', $year);

        match ($noticeSort) {
            'starts_on' => $notices->orderBy('starts_on', $noticeDirection),
            'section' => $this->orderByGradeLevel($notices, $noticeDirection),
            'sent_by' => $notices->orderBy('sent_by_name', $noticeDirection),
            'recipients' => $notices->orderBy('recipient_count', $noticeDirection),
            default => $notices->orderBy('created_at', $noticeDirection),
        };

        return Inertia::render('admin/advisories/index', [
            'advisories' => $advisories
                ->orderBy('section')
                ->orderBy('id')
                ->paginate(15)
                ->withQueryString(),
            // Every notice sent this school year, including by advisers since removed.
            'notices' => $notices
                ->orderBy('id', $noticeDirection)
                ->paginate(15, pageName: 'notices_page')
                ->withQueryString()
                ->through(fn (SuspensionNotice $notice) => [
                    ...$notice->only(['id', 'grade_level', 'section', 'sent_by_name', 'reason', 'recipient_count']),
                    'starts_on' => $notice->starts_on->toDateString(),
                    'ends_on' => $notice->ends_on?->toDateString(),
                    'created_at' => $notice->created_at->toIso8601String(),
                ]),
            'sorting' => [
                'advisories' => ['sort' => $sort, 'direction' => $direction],
                'notices' => ['sort' => $noticeSort, 'direction' => $noticeDirection],
            ],
            'educationLevels' => $this->educationLevels(),
            'teachers' => User::where('role', 'teacher')->orderBy('name')->get(['id', 'name']),
            'sections' => Section::whereIn('education_level', Advisory::EDUCATION_LEVELS)
                ->orderBy('name')
                ->get(['education_level', 'grade_level', 'name']),
        ]);
    }

    /**
     * A teacher's advisory classes, with the suspension notices sent to each.
     */
    public function mine(Request $request, SmsService $sms): Response
    {
        $current = SchoolYear::current();

        return Inertia::render('admin/advisories/mine', [
            'advisories' => $request->user('web')->advisories()
                ->with(['suspensionNotices' => fn ($query) => $query->latest()->limit(20)])
                ->orderByDesc('school_year')
                ->orderBy('grade_level')
                ->orderBy('section')
                ->get()
                ->map(fn (Advisory $advisory) => [
                    ...$advisory->only(['id', 'education_level', 'grade_level', 'section', 'school_year']),
                    'education_level_label' => Student::EDUCATION_LEVELS[$advisory->education_level]['label'] ?? null,
                    'is_current' => $advisory->school_year === $current,
                    'student_count' => $advisory->students()->count(),
                    'recipient_count' => $advisory->school_year === $current ? $sms->suspensionRecipients($advisory)->count() : 0,
                    'notices' => $advisory->suspensionNotices
                        // Plain Y-m-d days: the page reads them as calendar dates, not instants.
                        ->map(fn (SuspensionNotice $notice) => [
                            ...$notice->only(['id', 'reason', 'message', 'recipient_count']),
                            'starts_on' => $notice->starts_on->toDateString(),
                            'ends_on' => $notice->ends_on?->toDateString(),
                            'created_at' => $notice->created_at->toIso8601String(),
                        ])
                        ->all(),
                ]),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $educationLevel = $request->string('education_level')->toString();

        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('role', 'teacher')],
            'education_level' => ['required', Rule::in(Advisory::EDUCATION_LEVELS)],
            'grade_level' => ['required', 'string', Rule::in(Student::EDUCATION_LEVELS[$educationLevel]['grade_levels'] ?? [])],
            'section' => ['required', 'string', 'max:100'],
            'school_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
        ], [
            'user_id.exists' => __('Choose a user with the teacher role.'),
            'education_level.in' => __('Only Junior and Senior High School sections have advisers.'),
            'grade_level.in' => __('Choose a year level for this education level.'),
            'school_year.regex' => __('School year must look like 2026-2027.'),
        ]);

        $section = Section::resolve($data['education_level'], $data['grade_level'], $data['section']);

        if ($section === null) {
            throw ValidationException::withMessages([
                'section' => __('Add this section for :grade on the Sections page first.', ['grade' => $data['grade_level']]),
            ]);
        }

        $data['section'] = $section;

        $taken = Advisory::with('adviser:id,name')
            ->where('education_level', $data['education_level'])
            ->where('grade_level', $data['grade_level'])
            ->where('section', $section)
            ->where('school_year', $data['school_year'])
            ->first();

        if ($taken !== null) {
            throw ValidationException::withMessages([
                'section' => __(':name already advises this section for :year. Remove them first.', [
                    'name' => $taken->adviser->name,
                    'year' => $data['school_year'],
                ]),
            ]);
        }

        Advisory::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Adviser assigned.')]);

        return to_route('admin.advisories.index');
    }

    public function destroy(Advisory $advisory): RedirectResponse
    {
        $advisory->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Adviser removed.')]);

        return to_route('admin.advisories.index');
    }

    /**
     * The column and direction asked for, falling back to the default when the
     * query string names anything outside the allowed columns.
     *
     * @param  list<string>  $columns
     * @return array{0: string, 1: 'asc'|'desc'}
     */
    private function sorting(Request $request, string $sortKey, string $directionKey, array $columns, string $default, string $defaultDirection): array
    {
        $sort = $request->string($sortKey)->toString();

        if (! in_array($sort, $columns, true)) {
            return [$default, $defaultDirection === 'desc' ? 'desc' : 'asc'];
        }

        return [$sort, $request->string($directionKey)->toString() === 'desc' ? 'desc' : 'asc'];
    }

    /**
     * Year levels in school order ("Grade 7" before "Grade 10"), then section.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     */
    private function orderByGradeLevel(Builder $query, string $direction): void
    {
        $direction = $direction === 'desc' ? 'desc' : 'asc';

        $query->orderByRaw('LENGTH(grade_level) '.$direction)
            ->orderBy('grade_level', $direction)
            ->orderBy('section', $direction);
    }

    /**
     * @return list<array{value: string, label: string, grade_levels: list<string>}>
     */
    private function educationLevels(): array
    {
        return array_values(array_filter(
            Student::educationLevelOptions(),
            fn (array $level) => in_array($level['value'], Advisory::EDUCATION_LEVELS, true),
        ));
    }
}
