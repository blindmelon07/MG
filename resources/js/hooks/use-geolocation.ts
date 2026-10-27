import { useEffect, useRef, useState } from 'react';
import { useHydrated } from '@/hooks/use-hydrated';

export type GeoFix = {
    latitude: number;
    longitude: number;
    /** Radius of uncertainty in metres. */
    accuracy: number;
};

export type GeolocationStatus =
    | 'idle'
    | 'unsupported'
    | 'insecure'
    | 'locating'
    | 'active'
    | 'denied'
    | 'unavailable';

/**
 * Watches the device's position while `enabled`. Everything stays in the
 * browser — nothing here sends the position anywhere.
 *
 * Readings are smoothed: each one moves the position in proportion to how
 * accurate it is, so a rough ±60 m reading barely nudges a good fix, and
 * jumps no walker could make are ignored.
 *
 * With `keepBest`, the most accurate fix seen so far is kept instead of the
 * latest one (useful when recording a fixed reference point).
 */
export function useGeolocation(enabled: boolean, { keepBest = false } = {}) {
    const [fix, setFix] = useState<GeoFix | null>(null);
    const [error, setError] = useState<'denied' | 'unavailable' | null>(null);
    const filterRef = useRef<Filter | null>(null);

    const supported =
        typeof navigator !== 'undefined' && 'geolocation' in navigator;
    // Browsers only allow GPS on HTTPS pages (and localhost).
    const secure = typeof window !== 'undefined' && window.isSecureContext;
    // The server can't know about the browser's GPS.
    const hydrated = useHydrated();

    useEffect(() => {
        if (!enabled || !supported || !secure) {
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            ({ coords, timestamp }) => {
                const next = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy,
                };
                setError(null);

                if (keepBest) {
                    setFix((prev) =>
                        prev && prev.accuracy <= next.accuracy ? prev : next,
                    );

                    return;
                }

                const smoothed = smooth(filterRef.current, next, timestamp);

                if (smoothed) {
                    filterRef.current = smoothed;
                    setFix({
                        latitude: smoothed.latitude,
                        longitude: smoothed.longitude,
                        // What this reading claims, not the filter's own
                        // estimate: GPS errors drift together, so averaging
                        // readings doesn't make the fix truly that precise.
                        accuracy: next.accuracy,
                    });
                }
            },
            (err) =>
                setError(
                    err.code === err.PERMISSION_DENIED
                        ? 'denied'
                        : 'unavailable',
                ),
            // No cached readings: an old one would pull the dot back.
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
            filterRef.current = null;
        };
    }, [enabled, supported, secure, keepBest]);

    let status: GeolocationStatus;

    if (!enabled) {
        status = 'idle';
    } else if (!hydrated) {
        status = 'locating';
    } else if (!supported) {
        status = 'unsupported';
    } else if (!secure) {
        status = 'insecure';
    } else if (error) {
        status = error;
    } else {
        status = fix ? 'active' : 'locating';
    }

    return {
        status,
        fix: enabled ? fix : null,
        /** The signal dropped out; `fix` is the last known position. */
        stale: enabled && error === 'unavailable' && fix !== null,
        /** Forget the current fix, e.g. before taking a fresh reading. */
        reset: () => {
            filterRef.current = null;
            setFix(null);
            setError(null);
        },
    };
}

type Filter = {
    latitude: number;
    longitude: number;
    /** Uncertainty of the smoothed position, in square metres. */
    variance: number;
    /** When the last reading arrived (ms). */
    time: number;
};

// How far a visitor may plausibly have moved, as uncertainty growth per
// second: about a brisk walk. Larger values follow faster but jitter more.
const MOVE_VARIANCE_PER_SECOND = 2 ** 2;
// Faster than anyone moves on campus, beyond what the readings' own
// uncertainty explains: a GPS glitch, not the visitor.
const MAX_SPEED_MPS = 10;
const METERS_PER_DEG_LAT = 110_574;

/**
 * One step of a simple Kalman filter over latitude/longitude. Returns the
 * new estimate, or null to ignore this reading as a glitch.
 */
function smooth(prev: Filter | null, fix: GeoFix, time: number): Filter | null {
    const variance = fix.accuracy ** 2;

    if (!prev) {
        return {
            latitude: fix.latitude,
            longitude: fix.longitude,
            variance,
            time,
        };
    }

    const seconds = Math.max(0, (time - prev.time) / 1000);
    const predicted = prev.variance + MOVE_VARIANCE_PER_SECOND * seconds;

    const metersPerDegLng = 111_320 * Math.cos((prev.latitude * Math.PI) / 180);
    const jump = Math.hypot(
        (fix.latitude - prev.latitude) * METERS_PER_DEG_LAT,
        (fix.longitude - prev.longitude) * metersPerDegLng,
    );

    // The allowance grows with time, so if the visitor really did move
    // (or the old estimate was wrong) the dot catches up a few seconds later.
    if (
        jump >
        MAX_SPEED_MPS * seconds + 2 * (Math.sqrt(predicted) + fix.accuracy)
    ) {
        return null;
    }

    const gain = predicted / (predicted + variance);

    return {
        latitude: prev.latitude + gain * (fix.latitude - prev.latitude),
        longitude: prev.longitude + gain * (fix.longitude - prev.longitude),
        variance: (1 - gain) * predicted,
        time,
    };
}
