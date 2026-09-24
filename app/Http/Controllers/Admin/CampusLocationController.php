<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCampusLocationRequest;
use App\Http\Requests\Admin\UpdateCampusLocationRequest;
use App\Models\CampusLocation;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CampusLocationController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/campus-locations/index', [
            'locations' => CampusLocation::orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(StoreCampusLocationRequest $request): RedirectResponse
    {
        CampusLocation::create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location added to the map.')]);

        return to_route('admin.campus-locations.index');
    }

    public function update(UpdateCampusLocationRequest $request, CampusLocation $campusLocation): RedirectResponse
    {
        $campusLocation->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location updated.')]);

        return to_route('admin.campus-locations.index');
    }

    public function destroy(CampusLocation $campusLocation): RedirectResponse
    {
        $campusLocation->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location removed.')]);

        return to_route('admin.campus-locations.index');
    }
}
