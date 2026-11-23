<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\CampusLocation;
use App\Models\CampusPanorama;
use App\Models\DirectoryEntry;
use App\Models\MapReferencePoint;
use App\Support\KioskPosition;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The kiosk's home screen: the 3D campus map itself, mall-directory style.
 * Visitors pick a building or office and the kiosk draws the walk from
 * where it stands.
 */
class HomeController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('kiosk/home', [
            'locations' => CampusLocation::orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'photo_path', 'x', 'y']),
            'offices' => DirectoryEntry::where('category', 'office')
                ->whereNotNull('campus_location_id')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'phone', 'office_hours', 'room', 'floor_room', 'campus_location_id']),
            'kioskPosition' => KioskPosition::current(),
            // Turns map percent into real metres for walking distances, and
            // places the 360° photos along a route.
            'referencePoints' => MapReferencePoint::get(['latitude', 'longitude', 'x', 'y']),
            'panoramas' => CampusPanorama::get(['id', 'title', 'path', 'latitude', 'longitude', 'north_offset']),
            'featuredEvents' => Announcement::featuredEvents()
                ->with(['media' => fn ($query) => $query->where('type', 'image')->orderBy('sort_order')])
                ->orderBy('event_start_at')
                ->take(6)
                ->get(['id', 'title', 'slug', 'content', 'event_start_at', 'event_end_at', 'location'])
                ->map(fn (Announcement $event) => [
                    ...Arr::only($event->toArray(), ['id', 'title', 'slug', 'event_start_at', 'event_end_at', 'location']),
                    'summary' => Str::limit(strip_tags($event->content), 100),
                    'cover_url' => $event->media->first()?->url,
                ]),
            'latestAnnouncements' => Announcement::published()
                ->latest('published_at')
                ->take(5)
                ->get(['id', 'title', 'slug', 'type', 'published_at', 'event_start_at', 'location']),
            // Phones carry their own GPS, so they get walking navigation on the
            // Campus Map instead of routes from the kiosk's spot.
            // "Show me the way" from the Directory opens with the route drawn.
            'focus' => [
                'office' => $request->integer('office') ?: null,
                'location' => $request->integer('location') ?: null,
            ],
            'handheld' => (bool) preg_match('/Android|iPhone|iPad|iPod|Mobile/i', (string) $request->userAgent()),
        ]);
    }
}
