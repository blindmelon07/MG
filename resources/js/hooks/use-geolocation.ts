import { useEffect, useState } from 'react';

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
 * With `keepBest`, the most accurate fix seen so far is kept instead of the
 * latest one (useful when recording a fixed reference point).
 */
export function useGeolocation(enabled: boolean, { keepBest = false } = {}) {
    const [fix, setFix] = useState<GeoFix | null>(null);
    const [error, setError] = useState<'denied' | 'unavailable' | null>(null);

    const supported =
        typeof navigator !== 'undefined' && 'geolocation' in navigator;
    // Browsers only allow GPS on HTTPS pages (and localhost).
    const secure = typeof window !== 'undefined' && window.isSecureContext;

    useEffect(() => {
        if (!enabled || !supported || !secure) {
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            ({ coords }) => {
                const next = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy,
                };
                setError(null);
                setFix((prev) =>
                    keepBest && prev && prev.accuracy <= next.accuracy
                        ? prev
                        : next,
                );
            },
            (err) =>
                setError(
                    err.code === err.PERMISSION_DENIED
                        ? 'denied'
                        : 'unavailable',
                ),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [enabled, supported, secure, keepBest]);

    let status: GeolocationStatus;

    if (!enabled) {
        status = 'idle';
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
        /** Forget the current fix, e.g. before taking a fresh reading. */
        reset: () => {
            setFix(null);
            setError(null);
        },
    };
}
