<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreMediaRequest;
use App\Models\Manual;
use App\Models\Media;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class ManualMediaController extends Controller
{
    use HandlesMediaUploads;

    public function store(StoreMediaRequest $request, Manual $manual): RedirectResponse
    {
        $this->attachMedia($manual, $request->file('file'), $request->validated('caption'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Media uploaded.')]);

        return to_route('admin.manuals.edit', $manual);
    }

    public function destroy(Manual $manual, Media $media): RedirectResponse
    {
        abort_unless($media->mediable_type === Manual::class && $media->mediable_id === $manual->id, 404);

        $this->detachMedia($media);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Media removed.')]);

        return to_route('admin.manuals.edit', $manual);
    }
}
