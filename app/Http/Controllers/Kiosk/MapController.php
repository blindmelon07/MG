<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\CampusLocation;
use App\Models\CampusPanorama;
use App\Models\MapPresence;
use App\Models\MapReferencePoint;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function index(Request $request): Response
    {
        $locations = CampusLocation::orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'x', 'y']);

        // Links in event SMS and emails open the map at the event's area.
        $event = $request->filled('event')
            ? Announcement::published()
                ->where('type', 'event')
                ->where('slug', $request->string('event')->toString())
                ->first(['id', 'title', 'slug', 'event_start_at', 'event_end_at', 'location', 'campus_location_id'])
            : null;

        $focusId = $event->campus_location_id ?? $request->integer('location');

        return Inertia::render('kiosk/maps/index', [
            'locations' => $locations,
            // Lets the visitor's phone place its own GPS fix on the map.
            'referencePoints' => MapReferencePoint::get(['latitude', 'longitude', 'x', 'y']),
            // 360° photos; the phone shows the one taken nearest to it.
            'panoramas' => CampusPanorama::get(['id', 'title', 'path', 'latitude', 'longitude', 'north_offset']),
            'focusLocationId' => $locations->contains('id', $focusId) ? $focusId : null,
            'event' => $event,
        ]);
    }

    /**
     * While "Show my location" is on, the phone reports where it is on the map
     * (map percent only, never raw GPS) so staff can see who's on campus.
     */
    public function presence(Request $request): HttpResponse
    {
        $data = $request->validate([
            'client' => ['required', 'uuid'],
            'x' => ['required', 'numeric', 'between:-10,110'],
            'y' => ['required', 'numeric', 'between:-10,110'],
        ]);

        MapPresence::updateOrCreate(
            ['session_key' => $this->clientKey($data['client'])],
            [
                'x' => round((float) $data['x'], 1),
                'y' => round((float) $data['y'], 1),
                'student_id' => $request->user('student')?->getAuthIdentifier(),
                'user_id' => $request->user('web')?->getAuthIdentifier(),
                'last_seen_at' => now(),
            ],
        );

        // Keep the table small: nobody needs yesterday's dots.
        MapPresence::where('last_seen_at', '<', now()->subHour())->delete();

        return response()->noContent();
    }

    public function leave(Request $request): HttpResponse
    {
        $data = $request->validate(['client' => ['required', 'uuid']]);

        MapPresence::where('session_key', $this->clientKey($data['client']))->delete();

        return response()->noContent();
    }

    /**
     * Each browser tab picks a random id, so one phone is one dot.
     */
    private function clientKey(string $client): string
    {
        return hash('sha256', $client);
    }
}
