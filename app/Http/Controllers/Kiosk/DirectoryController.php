<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\CampusLocation;
use App\Models\DirectoryEntry;
use Inertia\Inertia;
use Inertia\Response;

class DirectoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('kiosk/directory/index', [
            'entries' => DirectoryEntry::with('campusLocation:id,name')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'category', 'name', 'description', 'phone', 'email', 'office_hours', 'room', 'floor_room', 'campus_location_id']),
            // Major buildings are the campus map's own pins.
            'buildings' => CampusLocation::orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'photo_path']),
        ]);
    }
}
