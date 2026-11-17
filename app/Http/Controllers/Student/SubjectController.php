<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * College and graduate students choose the subjects they take each semester
 * of the current school year.
 */
class SubjectController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $student = $this->student($request);

        if (! $student->choosesSubjects()) {
            return to_route('student.grades');
        }

        $schoolYear = SchoolYear::current();

        return Inertia::render('student/subjects', [
            'schoolYear' => $schoolYear,
            'yearLevel' => $student->grade_level,
            'semesters' => Grade::TERMS,
            'subjects' => Subject::availableTo($student)
                ->with('course:id,code')
                ->orderBy('code')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'course_id', 'year_level', 'semester', 'units']),
            // Subject id => the semester it was chosen for.
            'chosen' => $student->subjects()
                ->wherePivot('school_year', $schoolYear)
                ->get()
                ->mapWithKeys(fn (Subject $subject) => [$subject->id => $subject->pivot->semester]),
        ]);
    }

    /**
     * Replace the subjects chosen for one semester of the current school year.
     */
    public function update(Request $request): RedirectResponse
    {
        $student = $this->student($request);
        abort_unless($student->choosesSubjects(), 403);

        $schoolYear = SchoolYear::current();
        $semester = $request->string('semester')->toString();

        // Subjects already taken in another semester this school year.
        $takenElsewhere = $student->subjects()
            ->wherePivot('school_year', $schoolYear)
            ->wherePivot('semester', '!=', $semester)
            ->pluck('subjects.id');

        $data = $request->validate([
            'semester' => ['required', Rule::in(Grade::TERMS)],
            'subject_ids' => ['present', 'array'],
            'subject_ids.*' => [
                'integer',
                'distinct',
                Rule::in(Subject::availableTo($student, $semester)->pluck('id')),
                Rule::notIn($takenElsewhere),
            ],
        ], [
            'subject_ids.*.in' => __('One of the subjects is not offered to you this semester.'),
            'subject_ids.*.not_in' => __('One of the subjects is already chosen for another semester.'),
        ]);

        DB::transaction(function () use ($student, $schoolYear, $data): void {
            $student->subjects()
                ->wherePivot('school_year', $schoolYear)
                ->wherePivot('semester', $data['semester'])
                ->detach();

            $student->subjects()->attach(
                collect($data['subject_ids'])->mapWithKeys(fn (int $id) => [
                    $id => ['school_year' => $schoolYear, 'semester' => $data['semester']],
                ])->all(),
            );
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subjects saved.')]);

        return to_route('student.subjects.index');
    }

    private function student(Request $request): Student
    {
        /** @var Student */
        return $request->user('student');
    }
}
