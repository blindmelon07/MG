<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCampusLocationRequest;
use App\Http\Requests\Admin\UpdateCampusLocationRequest;
use App\Models\CampusLocation;
use App\Models\CampusPanorama;
use App\Models\MapReferencePoint;
use App\Support\KioskPosition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
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
            'referencePoints' => MapReferencePoint::latest()->get(),
            'panoramas' => CampusPanorama::latest()->get(),
            'kioskPosition' => KioskPosition::current(),
            'kioskPositionSaved' => KioskPosition::saved() !== null,
        ]);
    }

    public function store(StoreCampusLocationRequest $request): RedirectResponse
    {
        $location = CampusLocation::create($request->safe()->except(['photo', 'remove_photo']));

        if ($request->hasFile('photo')) {
            $location->forceFill(['photo_path' => $request->file('photo')->store('campus-locations', 'public')])->save();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location added to the map.')]);

        return to_route('admin.campus-locations.index');
    }

    public function update(UpdateCampusLocationRequest $request, CampusLocation $campusLocation): RedirectResponse
    {
        $campusLocation->fill($request->safe()->except(['photo', 'remove_photo']));
        $old = $campusLocation->photo_path;

        if ($request->hasFile('photo')) {
            $campusLocation->photo_path = $request->file('photo')->store('campus-locations', 'public');
        } elseif ($request->boolean('remove_photo')) {
            $campusLocation->photo_path = null;
        }

        $campusLocation->save();

        if ($old && $old !== $campusLocation->photo_path) {
            Storage::disk('public')->delete($old);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location updated.')]);

        return to_route('admin.campus-locations.index');
    }

    public function destroy(CampusLocation $campusLocation): RedirectResponse
    {
        // The building's floor plan goes with it (cascade); keep its picture
        // path to clean up.
        $floorPlanImage = $campusLocation->floorPlan?->image_path;

        $campusLocation->delete();

        foreach (array_filter([$campusLocation->photo_path, $floorPlanImage]) as $path) {
            Storage::disk('public')->delete($path);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Location removed.')]);

        return to_route('admin.campus-locations.index');
    }
}
