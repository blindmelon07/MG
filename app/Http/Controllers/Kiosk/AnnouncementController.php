<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Announcement::published();

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('q')) {
            $search = $request->string('q');
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }

        return Inertia::render('kiosk/announcements/index', [
            'announcements' => $query->orderByDesc('published_at')
                ->get(['id', 'title', 'slug', 'content', 'type', 'event_start_at', 'event_end_at', 'location', 'published_at']),
            'filters' => $request->only(['type', 'q']),
        ]);
    }

    public function show(string $slug): Response
    {
        $announcement = Announcement::published()
            ->with('media')
            ->where('slug', $slug)
            ->firstOrFail();

        return Inertia::render('kiosk/announcements/show', [
            'announcement' => $announcement,
        ]);
    }
}
