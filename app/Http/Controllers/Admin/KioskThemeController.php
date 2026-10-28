<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateKioskThemeRequest;
use App\Models\Setting;
use App\Support\KioskTheme;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class KioskThemeController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('admin/kiosk-theme/edit', [
            'theme' => KioskTheme::current(),
            'defaults' => KioskTheme::DEFAULTS,
            'customized' => KioskTheme::saved() !== null,
        ]);
    }

    public function update(UpdateKioskThemeRequest $request): RedirectResponse
    {
        $colors = $request->validated();

        Setting::put(KioskTheme::SETTING, [
            'light' => array_map('strtolower', $colors['light']),
            'dark' => array_map('strtolower', $colors['dark']),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Kiosk colors saved.')]);

        return to_route('admin.kiosk-theme.edit');
    }

    public function destroy(): RedirectResponse
    {
        Setting::forget(KioskTheme::SETTING);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Kiosk colors reset to the defaults.')]);

        return to_route('admin.kiosk-theme.edit');
    }
}
