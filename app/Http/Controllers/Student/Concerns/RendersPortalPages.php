<?php

namespace App\Http\Controllers\Student\Concerns;

use Inertia\Inertia;
use Inertia\Response;

trait RendersPortalPages
{
    /**
     * Portal pages render inside the kiosk shell when the student signed in on the kiosk.
     *
     * @param  array<string, mixed>  $props
     */
    protected function portal(string $page, array $props = [], ?bool $kiosk = null): Response
    {
        $kiosk ??= (bool) session('student_kiosk', false);

        return Inertia::render(($kiosk ? 'kiosk/student/' : 'student/').$page, [
            ...$props,
            'kiosk' => $kiosk,
        ]);
    }
}
