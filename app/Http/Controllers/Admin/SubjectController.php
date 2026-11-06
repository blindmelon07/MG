<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Student;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SubjectController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/subjects/index', [
            'subjects' => Subject::orderBy('education_level')->orderBy('name')->get(),
            'educationLevels' => Student::educationLevelOptions(),
            'courses' => Course::orderBy('code')->get(['id', 'code', 'name', 'education_level']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Subject::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subject added.')]);

        return to_route('admin.subjects.index');
    }

    public function update(Request $request, Subject $subject): RedirectResponse
    {
        $subject->update($this->validated($request, $subject));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subject updated.')]);

        return to_route('admin.subjects.index');
    }

    public function destroy(Subject $subject): RedirectResponse
    {
        $subject->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subject removed.')]);

        return to_route('admin.subjects.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Subject $subject = null): array
    {
        $educationLevel = $request->string('education_level')->toString();
        // Only college and graduate subjects belong to a course.
        $courseId = Course::requiredFor($educationLevel) ? ($request->integer('course_id') ?: null) : null;

        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:32', Rule::unique('subjects', 'code')->ignore($subject)],
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('subjects', 'name')
                    ->where('education_level', $educationLevel)
                    ->where(fn ($query) => $courseId === null ? $query->whereNull('course_id') : $query->where('course_id', $courseId))
                    ->ignore($subject),
            ],
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'course_id' => [
                Rule::excludeIf(! Course::requiredFor($educationLevel)),
                'nullable',
                'integer',
                Rule::exists('courses', 'id')->where('education_level', $educationLevel),
            ],
            'units' => ['nullable', 'numeric', 'min:0', 'max:99'],
        ], [
            'name.unique' => $courseId === null
                ? __('This subject already exists for that education level.')
                : __('This course already has a subject with that name.'),
            'course_id.exists' => __('Choose a course from this education level.'),
        ]);

        $data['course_id'] ??= null;

        return array_map(fn ($value) => is_string($value) ? trim($value) : $value, $data);
    }
}
