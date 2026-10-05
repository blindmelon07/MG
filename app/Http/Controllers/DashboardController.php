<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\ChatbotLog;
use App\Models\Manual;
use App\Models\ManualCategory;
use App\Models\MapPresence;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        // Teachers and registrar staff land on the module they work in.
        return match ($request->user('web')->role) {
            'teacher' => to_route('admin.grades.index'),
            'registrar' => to_route('admin.students.index'),
            default => $this->overview(),
        };
    }

    private function overview(): Response
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
            // The page polls this prop on its own to keep the map live.
            'activeUsers' => fn () => $this->activeUsers(),
        ]);
    }

    /**
     * People currently sharing their location on the kiosk campus map.
     *
     * @return list<array{id: int, x: float, y: float, label: string, kind: string, last_seen_at: string}>
     */
    private function activeUsers(): array
    {
        return array_values(MapPresence::active()
            ->with('student:id,name', 'user:id,name')
            ->latest('last_seen_at')
            ->get()
            ->map(fn (MapPresence $presence) => [
                'id' => $presence->id,
                'x' => $presence->x,
                'y' => $presence->y,
                'label' => $presence->label(),
                'kind' => $presence->kind(),
                'last_seen_at' => $presence->last_seen_at->toIso8601String(),
            ])
            ->all());
    }
}
