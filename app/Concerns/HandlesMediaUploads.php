<?php

namespace App\Concerns;

use App\Models\Announcement;
use App\Models\Manual;
use App\Models\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

trait HandlesMediaUploads
{
    protected function attachMedia(Manual|Announcement $mediable, UploadedFile $file, ?string $caption): Media
    {
        $path = $file->store('media', 'public');
        $type = str_starts_with($file->getMimeType() ?? '', 'video/') ? 'video' : 'image';

        return $mediable->media()->create([
            'type' => $type,
            'path' => $path,
            'caption' => $caption,
            'sort_order' => ((int) $mediable->media()->max('sort_order')) + 1,
        ]);
    }

    protected function detachMedia(Media $media): void
    {
        Storage::disk('public')->delete($media->path);

        $media->delete();
    }
}
