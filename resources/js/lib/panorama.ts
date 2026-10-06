/** A 360° photo taken on campus, and the GPS spot where it was taken. */
export type CampusPanorama = {
    id: number;
    title: string | null;
    url: string;
    latitude: number;
    longitude: number;
    /** Where north sits across the photo, in degrees from its left edge. */
    north_offset: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const RAD = Math.PI / 180;

/** Straight-line (great-circle) distance between two GPS points, in metres. */
export function distanceMeters(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
) {
    const dLat = (b.latitude - a.latitude) * RAD;
    const dLng = (b.longitude - a.longitude) * RAD;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * RAD) *
            Math.cos(b.latitude * RAD) *
            Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// A different photo must be at least this much nearer before switching, so
// GPS jitter halfway between two spots doesn't flick back and forth.
const SWITCH_MARGIN_METERS = 4;

/**
 * The photo taken nearest to `here`. Sticks with `currentId` unless another
 * photo is clearly nearer.
 */
export function nearestPanorama(
    panoramas: CampusPanorama[],
    here: { latitude: number; longitude: number },
    currentId: number | null,
) {
    let nearest: { panorama: CampusPanorama; meters: number } | null = null;
    let current: { panorama: CampusPanorama; meters: number } | null = null;

    for (const panorama of panoramas) {
        const meters = distanceMeters(here, panorama);

        if (!nearest || meters < nearest.meters) {
            nearest = { panorama, meters };
        }

        if (panorama.id === currentId) {
            current = { panorama, meters };
        }
    }

    if (
        current &&
        nearest &&
        current.meters - nearest.meters < SWITCH_MARGIN_METERS
    ) {
        return current;
    }

    return nearest;
}

/** A photo's name for display. */
export function panoramaTitle(panorama: CampusPanorama) {
    return panorama.title?.trim() || '360° photo';
}
