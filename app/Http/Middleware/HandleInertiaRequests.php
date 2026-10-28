<?php

namespace App\Http\Middleware;

use App\Models\SchoolYear;
use App\Support\KioskTheme;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'student' => $request->user('student')?->only(['id', 'name', 'student_number', 'grade_level', 'section', 'grading_system']),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Null until an admin changes the kiosk colors.
            'kioskTheme' => fn () => KioskTheme::saved(),
            // The year staff are viewing; enrollment and grade pages follow it.
            'schoolYear' => fn () => $request->user('web')?->hasRole('admin', 'registrar', 'teacher')
                ? [
                    'selected' => SchoolYear::selected(),
                    'current' => SchoolYear::current(),
                    'options' => SchoolYear::names(),
                ]
                : null,
        ];
    }
}
