<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveDirectoryEntryRequest;
use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use App\Models\FloorPlan;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DirectoryEntryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/directory/index', [
            'entries' => DirectoryEntry::with('campusLocation:id,name')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'locations' => CampusLocation::orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name']),
            // Rooms an office can be placed in, per building.
            'floorPlans' => FloorPlan::get(['id', 'campus_location_id', 'floor', 'rooms'])
                ->map(fn (FloorPlan $plan) => [
                    'campus_location_id' => $plan->campus_location_id,
                    'floor' => $plan->floor,
                    'rooms' => array_map(fn (array $room) => [
                        'key' => $room['key'],
                        'name' => $room['name'],
                        'kind' => $room['kind'],
                    ], $plan->rooms),
                ]),
        ]);
    }

    public function store(SaveDirectoryEntryRequest $request): RedirectResponse
    {
        DirectoryEntry::create($request->entry());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Added to the directory.')]);

        return to_route('admin.directory-entries.index');
    }

    public function update(SaveDirectoryEntryRequest $request, DirectoryEntry $directoryEntry): RedirectResponse
    {
        $directoryEntry->update($request->entry());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Directory entry updated.')]);

        return to_route('admin.directory-entries.index');
    }

    public function destroy(DirectoryEntry $directoryEntry): RedirectResponse
    {
        $directoryEntry->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Removed from the directory.')]);

        return to_route('admin.directory-entries.index');
    }
}
