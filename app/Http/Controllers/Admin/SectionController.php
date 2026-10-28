<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Section;
use App\Models\Student;
use App\Models\TeachingAssignment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SectionController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/sections/index', [
            'sections' => Section::with('course:id,code')->orderBy('name')->get(),
            'educationLevels' => Student::educationLevelOptions(),
            'courses' => Course::orderBy('code')->get(['id', 'code', 'name', 'education_level']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Section::create($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Section added.')]);

        return to_route('admin.sections.index');
    }

    public function update(Request $request, Section $section): RedirectResponse
    {
        $data = $this->validated($request, $section);
        $previous = $section->only(['education_level', 'grade_level', 'name']);

        $section->update($data);

        // A renamed section keeps its students and teachers.
        if ($previous['name'] !== $section->name) {
            foreach ([Enrollment::class, Student::class, TeachingAssignment::class] as $model) {
                $model::where('education_level', $previous['education_level'])
                    ->where('grade_level', $previous['grade_level'])
                    ->where('section', $previous['name'])
                    ->update(['section' => $section->name]);
            }
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Section updated.')]);

        return to_route('admin.sections.index');
    }

    public function destroy(Section $section): RedirectResponse
    {
        $section->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Section removed. Students already in it keep it on their records.')]);

        return to_route('admin.sections.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Section $section = null): array
    {
        $educationLevel = $request->string('education_level')->toString();

        $data = $request->validate([
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'grade_level' => ['required', 'string', Rule::in(Student::EDUCATION_LEVELS[$educationLevel]['grade_levels'] ?? [])],
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('sections', 'name')
                    ->where('education_level', $educationLevel)
                    ->where('grade_level', $request->string('grade_level')->toString())
                    ->ignore($section),
            ],
            // Only college and graduate sections belong to a course.
            'course_id' => [
                Rule::excludeIf(! Course::requiredFor($educationLevel)),
                'nullable',
                'integer',
                Rule::exists('courses', 'id')->where('education_level', $educationLevel),
            ],
        ], [
            'grade_level.in' => __('Choose a year level for this education level.'),
            'name.unique' => __('This year level already has a section with that name.'),
            'course_id.exists' => __('Choose a course from this education level.'),
        ]);

        $data['name'] = trim($data['name']);
        $data['course_id'] ??= null;

        return $data;
    }
}
