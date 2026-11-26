<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveFloorPlanRequest;
use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use App\Models\FloorPlan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Indoor floor plans: an admin uploads a picture of a building's floor sign
 * and draws the rooms, hallways and entrances over it, so the kiosk can walk
 * visitors from the door to an office.
 */
class FloorPlanController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/floor-plans/index', [
            'plans' => FloorPlan::with('campusLocation:id,name')
                ->get()
                ->sortBy(fn (FloorPlan $plan) => $plan->campusLocation?->name)
                ->values()
                ->map(fn (FloorPlan $plan) => [
                    'id' => $plan->id,
                    'building' => $plan->campusLocation?->name,
                    'floor' => $plan->floor,
                    'rooms' => count($plan->rooms),
                    'entrances' => count($plan->entrances),
                    'image_url' => $plan->image_url,
                    'offices' => DirectoryEntry::where('campus_location_id', $plan->campus_location_id)
                        ->whereIn('floor_room', $plan->roomKeys())
                        ->count(),
                ]),
            'buildingsLeft' => CampusLocation::doesntHave('floorPlan')->count(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/floor-plans/create', $this->editorProps());
    }

    public function store(SaveFloorPlanRequest $request): RedirectResponse
    {
        $plan = new FloorPlan($request->plan());

        if ($request->hasFile('image')) {
            $plan->image_path = $request->file('image')->store('floor-plans', 'public');
        }

        $plan->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Floor plan saved.')]);

        return to_route('admin.floor-plans.edit', $plan);
    }

    public function edit(FloorPlan $floorPlan): Response
    {
        return Inertia::render('admin/floor-plans/edit', [
            ...$this->editorProps($floorPlan),
            'plan' => [
                ...$floorPlan->toWayfinding(),
                'campusLocationId' => $floorPlan->campus_location_id,
            ],
        ]);
    }

    public function update(SaveFloorPlanRequest $request, FloorPlan $floorPlan): RedirectResponse
    {
        $oldBuilding = $floorPlan->campus_location_id;
        $oldImage = $floorPlan->image_path;

        $floorPlan->fill($request->plan());

        if ($request->hasFile('image')) {
            $floorPlan->image_path = $request->file('image')->store('floor-plans', 'public');
        } elseif ($request->boolean('remove_image')) {
            $floorPlan->image_path = null;
        }

        DB::transaction(function () use ($floorPlan, $oldBuilding) {
            $floorPlan->save();

            // Offices pointing at rooms that are gone (or in the building
            // this plan no longer covers) fall back to the building itself.
            if ($oldBuilding !== $floorPlan->campus_location_id) {
                $this->forgetRooms($oldBuilding, []);
            }

            $this->forgetRooms($floorPlan->campus_location_id, $floorPlan->roomKeys());
        });

        if ($oldImage && $oldImage !== $floorPlan->image_path) {
            Storage::disk('public')->delete($oldImage);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Floor plan saved.')]);

        return to_route('admin.floor-plans.edit', $floorPlan);
    }

    public function destroy(FloorPlan $floorPlan): RedirectResponse
    {
        DB::transaction(function () use ($floorPlan) {
            $floorPlan->delete();
            $this->forgetRooms($floorPlan->campus_location_id, []);
        });

        if ($floorPlan->image_path) {
            Storage::disk('public')->delete($floorPlan->image_path);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Floor plan removed.')]);

        return to_route('admin.floor-plans.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function editorProps(?FloorPlan $plan = null): array
    {
        return [
            // Buildings that can take this plan: ones without a plan yet,
            // plus the plan's own.
            'locations' => CampusLocation::where(fn ($query) => $query
                ->doesntHave('floorPlan')
                ->when($plan, fn ($query) => $query->orWhere('id', $plan->campus_location_id)))
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'x', 'y']),
            // Offices already placed on this plan's rooms, to name rooms
            // after what's in them.
            'offices' => $plan
                ? DirectoryEntry::where('campus_location_id', $plan->campus_location_id)
                    ->whereNotNull('floor_room')
                    ->orderBy('name')
                    ->get(['id', 'name', 'floor_room'])
                : [],
        ];
    }

    /**
     * Clear office room links in a building that no longer match a room.
     *
     * @param  list<string>  $keep
     */
    private function forgetRooms(int $campusLocationId, array $keep): void
    {
        DirectoryEntry::where('campus_location_id', $campusLocationId)
            ->whereNotNull('floor_room')
            ->when($keep !== [], fn ($query) => $query->whereNotIn('floor_room', $keep))
            ->update(['floor_room' => null]);
    }
}
