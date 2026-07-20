<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\ManualCategory;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('kiosk/home', [
            'categories' => ManualCategory::withCount(['manuals' => fn ($query) => $query->published()])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'latestAnnouncements' => Announcement::published()
                ->latest('published_at')
                ->take(3)
                ->get(['id', 'title', 'slug', 'type', 'event_start_at']),
        ]);
    }
}
