<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\TeachingAssignment;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SchoolYearController extends Controller
{
    public function index(): Response
    {
        $enrolled = Enrollment::selectRaw('school_year, count(*) as total')->groupBy('school_year')->pluck('total', 'school_year');
        $graded = Grade::selectRaw('school_year, count(*) as total')->groupBy('school_year')->pluck('total', 'school_year');

        return Inertia::render('admin/school-years/index', [
            'schoolYears' => SchoolYear::orderByDesc('name')->get()->map(fn (SchoolYear $year) => [
                'id' => $year->id,
                'name' => $year->name,
                'is_current' => $year->is_current,
                'enrollments' => (int) ($enrolled[$year->name] ?? 0),
                'grades' => (int) ($graded[$year->name] ?? 0),
            ]),
            'suggested' => $this->nextName(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'unique:school_years,name', function (string $attribute, mixed $value, Closure $fail): void {
                if (! SchoolYear::isValidName(is_string($value) ? $value : null)) {
                    $fail(__('School year must look like 2026-2027.'));
                }
            }],
            'make_current' => ['sometimes', 'boolean'],
        ], [
            'name.unique' => __('That school year is already on the list.'),
        ]);

        $year = SchoolYear::create(['name' => $data['name']]);

        if ($request->boolean('make_current')) {
            $year->makeCurrent();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('School year added.')]);

        return to_route('admin.school-years.index');
    }

    /**
     * Mark a school year as the one in progress. New students are enrolled in it.
     */
    public function makeCurrent(SchoolYear $schoolYear): RedirectResponse
    {
        $schoolYear->makeCurrent();
        session()->forget(SchoolYear::SESSION_KEY);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('S.Y. :name is now the current school year.', ['name' => $schoolYear->name])]);

        return to_route('admin.school-years.index');
    }

    public function destroy(SchoolYear $schoolYear): RedirectResponse
    {
        $inUse = $schoolYear->is_current
            || Enrollment::where('school_year', $schoolYear->name)->exists()
            || Grade::where('school_year', $schoolYear->name)->exists()
            || TeachingAssignment::where('school_year', $schoolYear->name)->exists();

        if ($inUse) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Only an unused school year that isn\'t current can be removed.')]);

            return to_route('admin.school-years.index');
        }

        $schoolYear->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('School year removed.')]);

        return to_route('admin.school-years.index');
    }

    /**
     * Switch the school year this staff member is viewing. Records saved
     * from then on (enrollments, grades templates, assignments) use it too.
     */
    public function select(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'school_year' => ['required', 'string', Rule::in(SchoolYear::names()->all())],
        ]);

        if ($data['school_year'] === SchoolYear::current()) {
            $request->session()->forget(SchoolYear::SESSION_KEY);
        } else {
            $request->session()->put(SchoolYear::SESSION_KEY, $data['school_year']);
        }

        return back();
    }

    private function nextName(): string
    {
        $latest = SchoolYear::max('name') ?? SchoolYear::current();
        $start = (int) substr($latest, 0, 4) + 1;

        return $start.'-'.($start + 1);
    }
}
