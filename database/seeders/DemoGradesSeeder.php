<?php

namespace Database\Seeders;

use App\Models\Grade;
use App\Models\Student;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Sample students with grades, for demonstrating the grades module.
 *
 *   php artisan db:seed --class=DemoGradesSeeder
 *   php artisan db:seed --class=RemoveDemoGradesSeeder   (removes it all again)
 *
 * Safe to run on a live system:
 * - Every record is labelled DEMO (name, student number, section), so it is
 *   easy to spot and never mixes into a real section's class list.
 * - No guardians or phone numbers, so announcement SMS never reach anyone.
 * - No passwords: to demo the student portal, issue one from the Students page.
 * - No staff accounts are created.
 * - Running it again updates the same records instead of duplicating them.
 *
 * Not part of DatabaseSeeder on purpose; run it explicitly.
 */
class DemoGradesSeeder extends Seeder
{
    public const PREFIX = 'DEMO-';

    private const K12_SUBJECTS = [
        'Filipino',
        'English',
        'Mathematics',
        'Science',
        'Araling Panlipunan',
        'Edukasyon sa Pagpapakatao',
        'MAPEH',
        'Technology and Livelihood Education',
    ];

    /** @var array<string, list<array{0: string, 1: string, 2: string}>> "school year|term" => [code, title, units] */
    private const COLLEGE_TERMS = [
        '2025-2026|1st Semester' => [
            ['IT 101', 'Introduction to Computing', '3'],
            ['IT 102', 'Computer Programming 1', '3'],
            ['GE 101', 'Understanding the Self', '3'],
            ['GE 102', 'Mathematics in the Modern World', '3'],
            ['PE 1', 'Physical Fitness', '2'],
            ['NSTP 1', 'National Service Training Program 1', '3'],
        ],
        '2025-2026|2nd Semester' => [
            ['IT 103', 'Computer Programming 2', '3'],
            ['IT 104', 'Discrete Mathematics', '3'],
            ['GE 103', 'Purposive Communication', '3'],
            ['GE 104', 'Readings in Philippine History', '3'],
            ['PE 2', 'Rhythmic Activities', '2'],
            ['NSTP 2', 'National Service Training Program 2', '3'],
        ],
        // Current semester: midterms are in, finals aren't yet.
        '2026-2027|1st Semester' => [
            ['IT 201', 'Data Structures and Algorithms', '3'],
            ['IT 202', 'Information Management', '3'],
            ['GE 105', 'Science, Technology and Society', '3'],
            ['PE 3', 'Individual and Dual Sports', '2'],
        ],
    ];

    /** @var list<float> */
    private const COLLEGE_SCALE = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];

    public function run(): void
    {
        // Same numbers every run, so re-seeding doesn't reshuffle grades.
        mt_srand(20260928);

        DB::transaction(function (): void {
            $this->seedK12();
            $this->seedCollege();
        });

        $this->command->info('Demo students and grades seeded. Remove them with: php artisan db:seed --class=RemoveDemoGradesSeeder');
    }

    private function seedK12(): void
    {
        $students = [
            ['Juan Dela Cruz', 'Grade 8', 'DEMO Grade 8 - St. Thomas', 88],
            ['Maria Santos', 'Grade 8', 'DEMO Grade 8 - St. Thomas', 93],
            ['Jose Reyes', 'Grade 8', 'DEMO Grade 8 - St. Thomas', 78],
            ['Ana Garcia', 'Grade 7', 'DEMO Grade 7 - St. Peter', 85],
            ['Pedro Bautista', 'Grade 7', 'DEMO Grade 7 - St. Peter', 74],
        ];

        foreach ($students as $i => [$name, $gradeLevel, $section, $ability]) {
            $student = $this->student(sprintf('K12-%03d', $i + 1), $name, $gradeLevel, $section, 'k12');

            // Last school year: all four quarters in.
            foreach (self::K12_SUBJECTS as $subject) {
                $quarters = array_map(fn () => $this->k12Mark($ability), range(1, 4));
                $this->k12Grade($student, '2025-2026', $subject, $quarters);
            }

            // This school year: only the first quarter so far.
            foreach (self::K12_SUBJECTS as $subject) {
                $this->k12Grade($student, '2026-2027', $subject, [$this->k12Mark($ability), null, null, null]);
            }
        }
    }

    private function seedCollege(): void
    {
        $students = [
            ['Carlo Mendoza', 'BSIT 2nd Year', 'DEMO BSIT 2-A', 1.75],
            ['Bea Villanueva', 'BSIT 2nd Year', 'DEMO BSIT 2-A', 1.25],
            ['Mark Aquino', 'BSIT 2nd Year', 'DEMO BSIT 2-A', 2.5],
            ['Liza Ramos', 'BSIT 2nd Year', 'DEMO BSIT 2-A', 2.0],
        ];

        foreach ($students as $i => [$name, $gradeLevel, $section, $ability]) {
            $student = $this->student(sprintf('COL-%03d', $i + 1), $name, $gradeLevel, $section, 'college');

            foreach (self::COLLEGE_TERMS as $period => $subjects) {
                [$schoolYear, $term] = explode('|', $period);
                $current = $schoolYear === '2026-2027';

                foreach ($subjects as [$code, $title, $units]) {
                    $this->collegeGrade($student, $schoolYear, $term, $code, $title, (float) $units, $ability, $current);
                }
            }
        }
    }

    private function student(string $number, string $name, string $gradeLevel, string $section, string $system): Student
    {
        return Student::updateOrCreate(
            ['student_number' => self::PREFIX.$number],
            [
                'name' => "{$name} (DEMO)",
                'grade_level' => $gradeLevel,
                'section' => $section,
                'grading_system' => $system,
                'phone_number' => null,
                'status' => 'active',
            ],
        );
    }

    /**
     * @param  list<float|null>  $quarters
     */
    private function k12Grade(Student $student, string $schoolYear, string $subject, array $quarters): void
    {
        $final = Grade::k12Final($quarters);

        Grade::updateOrCreate(
            ['student_id' => $student->id, 'school_year' => $schoolYear, 'term' => null, 'subject' => $subject],
            [
                'grading_system' => 'k12',
                'q1' => $quarters[0],
                'q2' => $quarters[1],
                'q3' => $quarters[2],
                'q4' => $quarters[3],
                'final_grade' => $final,
                'remarks' => Grade::remarksFor('k12', $final),
            ],
        );
    }

    private function collegeGrade(
        Student $student,
        string $schoolYear,
        string $term,
        string $code,
        string $title,
        float $units,
        float $ability,
        bool $current,
    ): void {
        $midterm = $this->collegeMark($ability);
        $final = $current ? null : $this->collegeMark($ability);
        $remarks = $current ? null : Grade::remarksFor('college', $final);

        // One incomplete in the weakest student's record, to show how INC looks.
        if (! $current && $ability >= 2.5 && $code === 'IT 104') {
            $final = null;
            $remarks = 'INC';
        }

        Grade::updateOrCreate(
            ['student_id' => $student->id, 'school_year' => $schoolYear, 'term' => $term, 'subject' => $title],
            [
                'grading_system' => 'college',
                'subject_code' => $code,
                'units' => $units,
                'midterm' => $midterm,
                'final_grade' => $final,
                'remarks' => $remarks,
            ],
        );
    }

    /** A K-12 percentage around the student's usual level, kept within 65–99. */
    private function k12Mark(int $ability): float
    {
        return (float) max(65, min(99, $ability + mt_rand(-6, 6)));
    }

    /** A college grade on the 1.00–3.00 scale, one or two steps from the student's usual level. */
    private function collegeMark(float $ability): float
    {
        $index = (int) array_search($ability, self::COLLEGE_SCALE, true) + mt_rand(-1, 2);

        return self::COLLEGE_SCALE[max(0, min(count(self::COLLEGE_SCALE) - 1, $index))];
    }
}
