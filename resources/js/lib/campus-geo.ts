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
    /** Real-world offset, in metres east and north, between two map points. */
    offsetMeters: (
        from: { x: number; y: number },
        to: { x: number; y: number },
    ) => { east: number; north: number };
    /**
     * Unit direction in the 3D scene (x/z world axes) for a compass heading,
     * in degrees clockwise from north.
     */
    headingToWorld: (headingDegrees: number) => { x: number; z: number };
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

    // Inverse of the rotation + scale: z = w / a.
    const offsetMeters = (
        from: { x: number; y: number },
        to: { x: number; y: number },
    ) => {
        const dRe = ((to.x - from.x) / 100) * SITE_WIDTH;
        const dIm = -((to.y - from.y) / 100) * SITE_DEPTH;
        const aa = a.re * a.re + a.im * a.im;

        return {
            east: (dRe * a.re + dIm * a.im) / aa,
            north: (dIm * a.re - dRe * a.im) / aa,
        };
    };

    // Real-world north and east as scene directions: a·i and a·1, turned from
    // w-space (y flipped) back into world x/z.
    const north = { x: -a.im / scale, z: -a.re / scale };
    const east = { x: a.re / scale, z: -a.im / scale };

    const headingToWorld = (headingDegrees: number) => {
        const h = (headingDegrees * Math.PI) / 180;

        return {
            x: Math.cos(h) * north.x + Math.sin(h) * east.x,
            z: Math.cos(h) * north.z + Math.sin(h) * east.z,
        };
    };

    return { project, offsetMeters, headingToWorld, errorMeters };
}

export type ParsedCoordinates =
    | {
          ok: true;
          latitude: number;
          longitude: number;
          /** From a Maps link: that's the view's centre, not an exact spot. */
          fromLink: boolean;
      }
    | { ok: false; error: string };

/**
 * Reads coordinates pasted from Google Maps: the "13.0365, 124.0032" it
 * copies on right-click, a Maps link ("…/@13.0365,124.0032,17z…"), or the
 * "13.0365° N, 124.0032° E" style.
 */
export function parseCoordinates(input: string): ParsedCoordinates {
    const text = input.trim();

    if (text === '') {
        return { ok: false, error: 'Paste the coordinates first.' };
    }

    const number = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
    const fromLink =
        text.match(new RegExp(String.raw`@${number},${number}`)) ??
        text.match(
            new RegExp(String.raw`[?&](?:q|query|ll)=${number},${number}`),
        );
    const plain = text.match(
        new RegExp(
            String.raw`^${number}\s*°?\s*([NS])?\s*[,;\s]\s*${number}\s*°?\s*([EW])?$`,
            'i',
        ),
    );

    let latitude: number;
    let longitude: number;

    if (fromLink) {
        latitude = Number(fromLink[1]);
        longitude = Number(fromLink[2]);
    } else if (plain) {
        latitude =
            Number(plain[1]) * (plain[2]?.toUpperCase() === 'S' ? -1 : 1);
        longitude =
            Number(plain[3]) * (plain[4]?.toUpperCase() === 'W' ? -1 : 1);
    } else {
        return {
            ok: false,
            error: 'Couldn’t read that. It should look like 13.0365, 124.0032.',
        };
    }

    if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
        return {
            ok: false,
            error: 'The numbers look swapped. Latitude (the smaller number here) comes first.',
        };
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return { ok: false, error: 'Those aren’t valid coordinates.' };
    }

    return { ok: true, latitude, longitude, fromLink: fromLink !== null };
}

/** Compass bearing, in degrees clockwise from north, of an east/north offset. */
export function bearingDegrees({
    east,
    north,
}: {
    east: number;
    north: number;
}) {
    return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Where a bearing lies relative to the way the viewer faces, in words. */
export function relativeDirection(bearing: number, heading: number) {
    // -180..180, negative = to the left.
    const turn = ((bearing - heading + 540) % 360) - 180;
    const side = turn < 0 ? 'left' : 'right';
    const amount = Math.abs(turn);

    if (amount <= 25) {
        return { turn, label: 'straight ahead' };
    }

    if (amount <= 70) {
        return { turn, label: `ahead on your ${side}` };
    }

    if (amount <= 135) {
        return { turn, label: `on your ${side}` };
    }

    return { turn, label: 'behind you' };
}

const COMPASS = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
];

/** Nearest of the eight compass directions for an east/north offset. */
export function compassDirection({
    east,
    north,
}: {
    east: number;
    north: number;
}) {
    const degrees = (Math.atan2(east, north) * 180) / Math.PI;

    return COMPASS[((Math.round(degrees / 45) % 8) + 8) % 8];
}

/** "80 m", "350 m", "1.2 km" — rounded to what GPS can honestly claim. */
export function formatDistance(meters: number) {
    if (meters < 1000) {
        return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
    }

    return `${(meters / 1000).toFixed(1)} km`;
}

function mean(values: number[]) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
