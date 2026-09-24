import { SITE_DEPTH, SITE_WIDTH } from '@/components/campus-map';

/** A GPS reading taken on campus, paired with its spot on the map (percent). */
export type GeoReferencePoint = {
    latitude: number;
    longitude: number;
    x: number;
    y: number;
};

export type GeoProjector = {
    /** Converts a GPS fix to map x/y percent (may fall outside 0–100). */
    project: (latitude: number, longitude: number) => { x: number; y: number };
    /** Average distance, in metres, between the reference points and the fit. */
    errorMeters: number;
};

// Reference points closer together than this can't fix rotation or scale.
const MIN_SPREAD_METERS = 15;

/**
 * Fits the campus map to GPS from admin-recorded reference points.
 *
 * GPS is flattened to local east/north metres, then a similarity transform
 * (rotation + uniform scale + shift) is least-squares fitted onto the map's
 * world units. Written with complex numbers: w = a·z + b, where z is the
 * GPS point, w the map point, and a carries rotation and scale. Two points
 * spread apart are enough; more points average out GPS error.
 *
 * Returns null until there are enough usable reference points.
 */
export function createGeoProjector(
    points: GeoReferencePoint[],
): GeoProjector | null {
    if (points.length < 2) {
        return null;
    }

    const lat0 = mean(points.map((p) => p.latitude));
    const lng0 = mean(points.map((p) => p.longitude));
    const metersPerDegLat = 110_574;
    const metersPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);

    // z: east/north metres. w: map world units with the y axis flipped so
    // "down the map" and "north" don't form a mirror image.
    const toZ = (latitude: number, longitude: number) => ({
        re: (longitude - lng0) * metersPerDegLng,
        im: (latitude - lat0) * metersPerDegLat,
    });
    const zs = points.map((p) => toZ(p.latitude, p.longitude));
    const ws = points.map((p) => ({
        re: (p.x / 100) * SITE_WIDTH,
        im: -(p.y / 100) * SITE_DEPTH,
    }));

    const zMean = {
        re: mean(zs.map((z) => z.re)),
        im: mean(zs.map((z) => z.im)),
    };
    const wMean = {
        re: mean(ws.map((w) => w.re)),
        im: mean(ws.map((w) => w.im)),
    };

    let numRe = 0;
    let numIm = 0;
    let den = 0;

    zs.forEach((z, i) => {
        const zr = z.re - zMean.re;
        const zi = z.im - zMean.im;
        const wr = ws[i].re - wMean.re;
        const wi = ws[i].im - wMean.im;
        // (w - w̄) · conj(z - z̄)
        numRe += wr * zr + wi * zi;
        numIm += wi * zr - wr * zi;
        den += zr * zr + zi * zi;
    });

    if (den < MIN_SPREAD_METERS ** 2) {
        return null;
    }

    const a = { re: numRe / den, im: numIm / den };
    const scale = Math.hypot(a.re, a.im); // world units per metre

    const toWorld = (latitude: number, longitude: number) => {
        const z = toZ(latitude, longitude);
        const zr = z.re - zMean.re;
        const zi = z.im - zMean.im;

        return {
            re: a.re * zr - a.im * zi + wMean.re,
            im: a.re * zi + a.im * zr + wMean.im,
        };
    };

    const project = (latitude: number, longitude: number) => {
        const w = toWorld(latitude, longitude);

        return {
            x: (w.re / SITE_WIDTH) * 100,
            y: (-w.im / SITE_DEPTH) * 100,
        };
    };

    const errorMeters =
        mean(
            points.map((p, i) => {
                const w = toWorld(p.latitude, p.longitude);

                return Math.hypot(w.re - ws[i].re, w.im - ws[i].im);
            }),
        ) / scale;

    return { project, errorMeters };
}

function mean(values: number[]) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
