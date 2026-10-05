<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:32', Rule::unique('subjects', 'code')->ignore($subject)],
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('subjects', 'name')->where('education_level', $request->input('education_level'))->ignore($subject),
            ],
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'units' => ['nullable', 'numeric', 'min:0', 'max:99'],
        ], [
            'name.unique' => __('This subject already exists for that education level.'),
        ]);

        return array_map(fn ($value) => is_string($value) ? trim($value) : $value, $data);
    }
}
