<?php

namespace App\Support;

use App\Models\Student;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

/**
 * Printable student portal login slips with the school's header and footer.
 * A single slip is a strip a quarter of a short bond page (8.5in x 2.75in);
 * a batch prints four strips per page with dashed cut lines between them.
 */
class LoginSlips
{
    /** 8.5in x 11in short bond, in points. */
    private const PAGE_WIDTH = 612;

    private const PAGE_HEIGHT = 792;

    private const SLIPS_PER_PAGE = 4;

    /**
     * @return array{name: string, student_number: string, education_level: string|null, grade_level: string|null, section: string|null, password: string}
     */
    public static function entry(Student $student, string $password): array
    {
        return [
            'name' => $student->name,
            'student_number' => (string) $student->student_number,
            'education_level' => $student->educationLevelLabel(),
            'grade_level' => $student->grade_level,
            'section' => $student->section,
            'password' => $password,
        ];
    }

    /**
     * @param  list<array{name: string, student_number: string, education_level: string|null, grade_level: string|null, section: string|null, password: string}>  $slips
     * @param  bool  $strip  One slip on its own quarter-page strip, instead of full pages of four.
     */
    public static function download(array $slips, string $filename, bool $strip = false): Response
    {
        $pdf = Pdf::loadView('pdf.login-slips', [
            'slips' => $slips,
            'perPage' => $strip ? 1 : self::SLIPS_PER_PAGE,
            'school' => config('school'),
            'logo' => self::logo(),
            'portalUrl' => route('student.login'),
            'issuedAt' => now(),
        ])->setOption('isFontSubsettingEnabled', true)->setPaper([0, 0, self::PAGE_WIDTH, $strip ? self::PAGE_HEIGHT / self::SLIPS_PER_PAGE : self::PAGE_HEIGHT]);

        return $pdf->download($filename)->withHeaders(['Cache-Control' => 'no-store, private']);
    }

    /**
     * Embedded as a data URI so dompdf never fetches anything remotely.
     */
    private static function logo(): ?string
    {
        $path = config('school.logo');

        if (! is_string($path) || ! is_file($path)) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode((string) file_get_contents($path));
    }
}
