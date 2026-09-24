<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreMapReferencePointRequest;
use App\Models\MapReferencePoint;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class MapReferencePointController extends Controller
{
    public function store(StoreMapReferencePointRequest $request): RedirectResponse
    {
        MapReferencePoint::create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('GPS reference point saved.')]);

        return to_route('admin.campus-locations.index');
    }

    public function destroy(MapReferencePoint $mapReferencePoint): RedirectResponse
    {
        $mapReferencePoint->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('GPS reference point removed.')]);

        return to_route('admin.campus-locations.index');
    }
}
