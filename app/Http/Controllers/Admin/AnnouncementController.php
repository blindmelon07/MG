<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAnnouncementRequest;
use App\Http\Requests\Admin\UpdateAnnouncementRequest;
use App\Models\Announcement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    use GeneratesUniqueSlug, HandlesMediaUploads;

    public function index(): Response
    {
        return Inertia::render('admin/announcements/index', [
            'announcements' => Announcement::with('creator')
                ->latest()
                ->paginate(15)
                ->withQueryString(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/announcements/create');
    }

    public function store(StoreAnnouncementRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = $this->generateUniqueSlug(Announcement::class, $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['status'] === 'published' ? Carbon::now() : null;

        Announcement::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement created.')]);

        return to_route('admin.announcements.index');
    }

    public function edit(Announcement $announcement): Response
    {
        return Inertia::render('admin/announcements/edit', [
            'announcement' => $announcement->load('media'),
        ]);
    }

    public function update(UpdateAnnouncementRequest $request, Announcement $announcement): RedirectResponse
    {
        $data = $request->validated();

        if ($data['status'] === 'published' && $announcement->published_at === null) {
            $data['published_at'] = Carbon::now();
        } elseif ($data['status'] === 'draft') {
            $data['published_at'] = null;
        }

        $announcement->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement updated.')]);

        return to_route('admin.announcements.index');
    }

    public function destroy(Announcement $announcement): RedirectResponse
    {
        $announcement->media->each(fn ($media) => $this->detachMedia($media));

        $announcement->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement deleted.')]);

        return to_route('admin.announcements.index');
    }
}
