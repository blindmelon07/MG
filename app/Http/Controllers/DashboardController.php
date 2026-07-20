<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\ChatbotLog;
use App\Models\Manual;
use App\Models\ManualCategory;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('dashboard', [
            'stats' => [
                'manuals' => [
                    'total' => Manual::count(),
                    'published' => Manual::published()->count(),
                    'draft' => Manual::where('status', 'draft')->count(),
                ],
                'categories' => [
                    'total' => ManualCategory::count(),
                ],
                'announcements' => [
                    'total' => Announcement::count(),
                    'published' => Announcement::published()->count(),
                    'upcomingEvents' => Announcement::published()
                        ->where('type', 'event')
                        ->where('event_start_at', '>=', now())
                        ->count(),
                ],
                'chatbot' => [
                    'total' => ChatbotLog::count(),
                    'helpful' => ChatbotLog::where('was_helpful', true)->count(),
                    'notHelpful' => ChatbotLog::where('was_helpful', false)->count(),
                ],
            ],
            'recentAnnouncements' => Announcement::with('creator')
                ->latest()
                ->take(5)
                ->get(['id', 'title', 'type', 'status', 'created_by', 'created_at']),
        ]);
    }
}
