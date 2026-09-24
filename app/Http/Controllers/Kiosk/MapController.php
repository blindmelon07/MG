<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\CampusLocation;
use App\Models\MapReferencePoint;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('kiosk/maps/index', [
            'locations' => CampusLocation::orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'x', 'y']),
            // Lets the visitor's phone place its own GPS fix on the map.
            // The fix itself never leaves the phone.
            'referencePoints' => MapReferencePoint::get(['latitude', 'longitude', 'x', 'y']),
        ]);
    }
}
