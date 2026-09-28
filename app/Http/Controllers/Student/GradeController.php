<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Student\Concerns\RendersPortalPages;
use App\Models\Grade;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Response;

class GradeController extends Controller
{
    use RendersPortalPages;

    public function index(Request $request): Response
    {
        $student = $request->user('student');

        $groups = $student->grades()
            ->orderBy('subject')
            ->get()
            ->groupBy(fn (Grade $grade) => $grade->school_year.'|'.($grade->term ?? ''))
            // Most recent school year first; within a year, Summer > 2nd > 1st semester.
            ->sortByDesc(fn (Collection $grades) => $this->periodSortKey($grades->firstOrFail()));

        $periods = [];

        foreach ($groups as $key => $grades) {
            $first = $grades->firstOrFail();

            $periods[] = [
                'key' => (string) $key,
                'school_year' => $first->school_year,
                'term' => $first->term,
                'grading_system' => $first->grading_system,
                'average' => Grade::averageOf($grades, $first->grading_system),
                'total_units' => $first->grading_system === 'college'
                    ? (float) $grades->sum(fn (Grade $grade) => (float) $grade->units)
                    : null,
                'grades' => $grades->map(fn (Grade $grade) => $grade->only([
                    'id', 'subject_code', 'subject', 'units', 'q1', 'q2', 'q3', 'q4', 'midterm', 'final_grade', 'remarks',
                ]))->values()->all(),
            ];
        }

        return $this->portal('grades', [
            'student' => $student->only(['name', 'student_number', 'grade_level', 'section', 'grading_system']),
            'periods' => $periods,
        ]);
    }

    private function periodSortKey(Grade $grade): string
    {
        $index = array_search($grade->term, Grade::TERMS, true);

        return $grade->school_year.'|'.($index === false ? 0 : $index + 1);
    }
}
