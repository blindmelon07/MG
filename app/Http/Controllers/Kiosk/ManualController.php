<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Models\Manual;
use App\Models\ManualCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ManualController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Manual::published()->with('category');

        if ($request->filled('category')) {
            $query->whereHas('category', function ($categoryQuery) use ($request) {
                $categoryQuery->where('slug', $request->string('category'));
            });
        }

        if ($request->filled('q')) {
            $search = $request->string('q');
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }

        return Inertia::render('kiosk/manuals/index', [
            'manuals' => $query->orderBy('title')->get(['id', 'manual_category_id', 'title', 'slug', 'content']),
            'categories' => ManualCategory::orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'slug']),
            'filters' => $request->only(['category', 'q']),
        ]);
    }

    public function show(string $slug): Response
    {
        $manual = Manual::published()
            ->with(['category', 'media'])
            ->where('slug', $slug)
            ->firstOrFail();

        return Inertia::render('kiosk/manuals/show', [
            'manual' => $manual,
        ]);
    }
}
