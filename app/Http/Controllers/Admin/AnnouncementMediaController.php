<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreMediaRequest;
use App\Models\Announcement;
use App\Models\Media;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class AnnouncementMediaController extends Controller
{
    use HandlesMediaUploads;

    public function store(StoreMediaRequest $request, Announcement $announcement): RedirectResponse
    {
        $this->attachMedia($announcement, $request->file('file'), $request->validated('caption'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Media uploaded.')]);

        return to_route('admin.announcements.edit', $announcement);
    }

    public function destroy(Announcement $announcement, Media $media): RedirectResponse
    {
        abort_unless($media->mediable_type === Announcement::class && $media->mediable_id === $announcement->id, 404);

        $this->detachMedia($media);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Media removed.')]);

        return to_route('admin.announcements.edit', $announcement);
    }
}
