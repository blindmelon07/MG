<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCampusPanoramaRequest;
use App\Http\Requests\Admin\UpdateCampusPanoramaRequest;
use App\Models\CampusPanorama;
use App\Support\PanoramaImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use RuntimeException;

class CampusPanoramaController extends Controller
{
    public function store(StoreCampusPanoramaRequest $request): RedirectResponse
    {
        $file = $request->file('image');

        // 360° cameras store where the photo was taken; typed-in
        // coordinates are only the fallback for photos without GPS.
        $gps = PanoramaImage::gps($file->getRealPath())
            ?? ($request->filled('latitude') ? [
                'latitude' => (float) $request->input('latitude'),
                'longitude' => (float) $request->input('longitude'),
            ] : null);

        if ($gps === null) {
            throw ValidationException::withMessages([
                'latitude' => __('This photo has no GPS location in it. Enter where it was taken.'),
            ]);
        }

        try {
            $path = PanoramaImage::store($file);
        } catch (RuntimeException) {
            throw ValidationException::withMessages([
                'image' => __('That image couldn\'t be read. Try exporting it again as a JPEG.'),
            ]);
        }

        CampusPanorama::create([
            'title' => $request->validated('title'),
            'path' => $path,
            ...$gps,
            'north_offset' => $request->validated('north_offset') ?? 0,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('360° photo added.')]);

        return to_route('admin.campus-locations.index');
    }

    public function update(UpdateCampusPanoramaRequest $request, CampusPanorama $campusPanorama): RedirectResponse
    {
        $data = $request->safe()->except('image');

        // A replacement photo keeps the position and north set here, since
        // those are usually more exact than what the camera saved.
        if ($request->hasFile('image')) {
            try {
                $data['path'] = PanoramaImage::store($request->file('image'));
            } catch (RuntimeException) {
                throw ValidationException::withMessages([
                    'image' => __('That image couldn\'t be read. Try exporting it again as a JPEG.'),
                ]);
            }

            Storage::disk('public')->delete($campusPanorama->path);
        }

        $campusPanorama->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('360° photo updated.')]);

        return to_route('admin.campus-locations.index');
    }

    public function destroy(CampusPanorama $campusPanorama): RedirectResponse
    {
        Storage::disk('public')->delete($campusPanorama->path);
        $campusPanorama->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('360° photo removed.')]);

        return to_route('admin.campus-locations.index');
    }
}
