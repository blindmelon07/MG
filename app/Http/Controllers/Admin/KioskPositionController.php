<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\KioskPosition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KioskPositionController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'x' => ['required', 'numeric', 'between:0,100'],
            'y' => ['required', 'numeric', 'between:0,100'],
        ]);

        Setting::put(KioskPosition::SETTING, [
            'x' => round((float) $data['x'], 2),
            'y' => round((float) $data['y'], 2),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Kiosk position saved.')]);

        return back();
    }

    public function destroy(): RedirectResponse
    {
        Setting::forget(KioskPosition::SETTING);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Kiosk position reset to the Main Gate.')]);

        return back();
    }
}
