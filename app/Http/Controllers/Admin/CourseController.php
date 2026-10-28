<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Student;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CourseController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/courses/index', [
            'courses' => Course::withCount('students')->orderBy('education_level')->orderBy('code')->get(),
            'educationLevels' => $this->educationLevels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Course::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Course added.')]);

        return to_route('admin.courses.index');
    }

    public function update(Request $request, Course $course): RedirectResponse
    {
        $course->update($this->validated($request, $course));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Course updated.')]);

        return to_route('admin.courses.index');
    }

    public function destroy(Course $course): RedirectResponse
    {
        if ($course->students()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Move its students to another course before removing it.')]);

            return to_route('admin.courses.index');
        }

        $course->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Course removed.')]);

        return to_route('admin.courses.index');
    }

    /**
     * @return list<array{value: string, label: string, grade_levels: list<string>}>
     */
    private function educationLevels(): array
    {
        return array_values(array_filter(
            Student::educationLevelOptions(),
            fn (array $level) => Course::requiredFor($level['value']),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Course $course = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32', Rule::unique('courses', 'code')->ignore($course)],
            'name' => ['required', 'string', 'max:255'],
            'education_level' => ['required', Rule::in(Course::EDUCATION_LEVELS)],
            'units' => ['nullable', 'numeric', 'min:0', 'max:999'],
        ], [
            'code.unique' => __('Another course already uses this code.'),
        ]);

        return array_map(fn ($value) => is_string($value) ? trim($value) : $value, $data);
    }
}
