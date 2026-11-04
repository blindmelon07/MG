<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\ManualCategory;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('kiosk/home', [
            'featuredEvents' => Announcement::featuredEvents()
                ->with(['media' => fn ($query) => $query->where('type', 'image')->orderBy('sort_order')])
                ->orderBy('event_start_at')
                ->take(6)
                ->get(['id', 'title', 'slug', 'content', 'event_start_at', 'event_end_at', 'location'])
                ->map(fn (Announcement $event) => [
                    ...Arr::only($event->toArray(), ['id', 'title', 'slug', 'event_start_at', 'event_end_at', 'location']),
                    'summary' => Str::limit(strip_tags($event->content), 140),
                    'cover_url' => $event->media->first()?->url,
                ]),
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
