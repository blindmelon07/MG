<?php

namespace App\Console\Commands;

use App\Models\CampusPanorama;
use App\Support\PanoramaImage;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use RuntimeException;

#[Signature('panoramas:import {folder : Folder of 360° JPEGs straight from the camera} {--dry-run : Only check the photos, don\'t add them}')]
#[Description('Add a folder of 360° photos to the campus map, placed by their own GPS')]
class ImportPanoramas extends Command
{
    public function handle(): int
    {
        $folder = rtrim($this->argument('folder'), '/\\');

        if (! is_dir($folder)) {
            $this->error("No folder at {$folder}.");

            return self::FAILURE;
        }

        $files = glob($folder.'/*.{jpg,jpeg,JPG,JPEG}', GLOB_BRACE) ?: [];

        if ($files === []) {
            $this->warn('No JPEGs in that folder.');

            return self::SUCCESS;
        }

        $added = 0;

        foreach ($files as $file) {
            $name = basename($file);

            if ($problem = $this->problem($file)) {
                $this->warn("Skipped {$name}: {$problem}");

                continue;
            }

            $gps = PanoramaImage::gps($file);

            // Same spot as a photo already on the map: most likely a re-run.
            if (CampusPanorama::where($gps)->exists()) {
                $this->line("Skipped {$name}: already on the map.");

                continue;
            }

            if ($this->option('dry-run')) {
                $this->info("OK {$name} ({$gps['latitude']}, {$gps['longitude']})");
                $added++;

                continue;
            }

            try {
                $path = PanoramaImage::store(new UploadedFile($file, $name, 'image/jpeg', null, true));
            } catch (RuntimeException) {
                $this->warn("Skipped {$name}: the image couldn't be read.");

                continue;
            }

            CampusPanorama::create([...$gps, 'path' => $path, 'north_offset' => 0]);
            $this->info("Added {$name} ({$gps['latitude']}, {$gps['longitude']})");
            $added++;
        }

        $this->newLine();
        $this->info($this->option('dry-run')
            ? "{$added} of ".count($files).' photos would be added.'
            : "{$added} of ".count($files).' photos added. Give them titles in Admin > Campus Locations.');

        return self::SUCCESS;
    }

    /**
     * Why the upload form would turn this photo away, if it would.
     */
    private function problem(string $file): ?string
    {
        $size = @getimagesize($file);

        if ($size === false || $size[2] !== IMAGETYPE_JPEG) {
            return 'not a JPEG.';
        }

        if (filesize($file) > 40 * 1024 * 1024) {
            return 'bigger than 40 MB.';
        }

        [$width, $height] = $size;

        if ($width < 1024 || $width !== $height * 2) {
            return "{$width} × {$height} isn't a 2:1 360° photo.";
        }

        if (PanoramaImage::gps($file) === null) {
            return 'no GPS in the photo. Upload it from the admin page and enter where it was taken.';
        }

        return null;
    }
}
