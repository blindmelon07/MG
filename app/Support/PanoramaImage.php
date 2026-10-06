<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Reading and storing 360° photos.
 */
class PanoramaImage
{
    /**
     * Most phones can't draw a 3D texture wider than this, and it keeps
     * loading quick on mobile data.
     */
    public const MAX_WIDTH = 4096;

    /**
     * The GPS spot a camera (e.g. Insta360) stored in the photo's EXIF.
     *
     * @return array{latitude: float, longitude: float}|null
     */
    public static function gps(string $path): ?array
    {
        if (! function_exists('exif_read_data')) {
            return null;
        }

        $exif = @exif_read_data($path, 'GPS');

        if (! $exif || ! isset($exif['GPSLatitude'], $exif['GPSLongitude'])) {
            return null;
        }

        $latitude = self::degrees($exif['GPSLatitude'], $exif['GPSLatitudeRef'] ?? 'N');
        $longitude = self::degrees($exif['GPSLongitude'], $exif['GPSLongitudeRef'] ?? 'E');

        if ($latitude === null || $longitude === null || ($latitude == 0.0 && $longitude == 0.0)) {
            return null;
        }

        return ['latitude' => round($latitude, 7), 'longitude' => round($longitude, 7)];
    }

    /**
     * Saves the photo to the public disk as a JPEG no wider than MAX_WIDTH,
     * keeping its 2:1 shape. Returns the stored path.
     */
    public static function store(UploadedFile $file): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));

        if ($source === false) {
            throw new RuntimeException('Could not read the image.');
        }

        $width = imagesx($source);
        $height = imagesy($source);

        if ($width > self::MAX_WIDTH) {
            $newWidth = self::MAX_WIDTH;
            $newHeight = (int) round($height * self::MAX_WIDTH / $width);
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            $source = $resized;
        }

        ob_start();
        imagejpeg($source, null, 85);
        $jpeg = (string) ob_get_clean();

        $path = 'panoramas/'.Str::uuid().'.jpg';
        Storage::disk('public')->put($path, $jpeg);

        return $path;
    }

    /**
     * EXIF stores degrees, minutes and seconds as "num/den" fractions.
     *
     * @param  array<int, string>|mixed  $parts
     */
    private static function degrees(mixed $parts, string $ref): ?float
    {
        if (! is_array($parts) || count($parts) < 3) {
            return null;
        }

        [$d, $m, $s] = array_map(self::fraction(...), array_slice($parts, 0, 3));
        $value = $d + $m / 60 + $s / 3600;

        return in_array(strtoupper($ref), ['S', 'W'], true) ? -$value : $value;
    }

    private static function fraction(mixed $value): float
    {
        if (is_string($value) && str_contains($value, '/')) {
            [$num, $den] = array_map('floatval', explode('/', $value, 2));

            return $den == 0.0 ? 0.0 : $num / $den;
        }

        return (float) $value;
    }
}
