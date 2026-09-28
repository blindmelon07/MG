import { useCallback, useEffect, useState } from 'react';

export type HeadingStatus =
    | 'idle'
    | 'unsupported'
    /** iOS: the user must tap a button before the compass can be read. */
    | 'needs-permission'
    | 'denied'
    | 'waiting'
    | 'active'
    /** Events arrive but aren't tied to north (e.g. no magnetometer). */
    | 'unavailable';

type IOSOrientationEvent = DeviceOrientationEvent & {
    webkitCompassHeading?: number;
};

type OrientationPermission = {
    requestPermission?: () => Promise<'granted' | 'denied'>;
};

// Ignore changes smaller than this, so a hand's tremble doesn't re-render at 60 fps.
const MIN_CHANGE_DEGREES = 1;
// How long to wait for a north-referenced reading before giving up.
const WAIT_MS = 3000;

const DEG = Math.PI / 180;

/**
 * Compass heading (degrees clockwise from north) of the direction the viewer
 * faces. Uses the horizontal part of both the phone's top edge and the
 * direction its back camera points, so it stays steady whether the phone is
 * held flat or upright.
 *
 * Based on the W3C DeviceOrientation rotation matrix (alpha, beta, gamma).
 */
function headingFromEuler(alpha: number, beta: number, gamma: number) {
    const cX = Math.cos(beta * DEG);
    const cY = Math.cos(gamma * DEG);
    const cZ = Math.cos(alpha * DEG);
    const sX = Math.sin(beta * DEG);
    const sY = Math.sin(gamma * DEG);
    const sZ = Math.sin(alpha * DEG);

    // Device top edge (y axis) and back (-z axis), in east/north terms.
    const topEast = -cX * sZ;
    const topNorth = cZ * cX;
    const backEast = -(cY * sZ * sX + cZ * sY);
    const backNorth = -(sZ * sY - cZ * cY * sX);

    const east = topEast + backEast;
    const north = topNorth + backNorth;

    return (Math.atan2(east, north) / DEG + 360) % 360;
}

function angleDifference(a: number, b: number) {
    return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Watches the phone's compass while `enabled`. Everything stays in the
 * browser; nothing here is sent anywhere.
 */
export function useDeviceHeading(enabled: boolean) {
    const supported =
        typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const needsPermission =
        supported &&
        typeof (DeviceOrientationEvent as unknown as OrientationPermission)
            .requestPermission === 'function';

    const [permission, setPermission] = useState<
        'unknown' | 'granted' | 'denied'
    >('unknown');
    const [heading, setHeading] = useState<number | null>(null);
    const [timedOut, setTimedOut] = useState(false);

    const listening =
        enabled && supported && (!needsPermission || permission === 'granted');

    useEffect(() => {
        if (!listening) {
            return;
        }

        let received = false;

        const update = (next: number) => {
            received = true;
            setTimedOut(false);
            setHeading((prev) =>
                prev !== null &&
                angleDifference(prev, next) < MIN_CHANGE_DEGREES
                    ? prev
                    : next,
            );
        };

        const handleAbsolute = (event: DeviceOrientationEvent) => {
            if (
                event.alpha !== null &&
                event.beta !== null &&
                event.gamma !== null
            ) {
                update(headingFromEuler(event.alpha, event.beta, event.gamma));
            }
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
            const ios = (event as IOSOrientationEvent).webkitCompassHeading;

            if (typeof ios === 'number' && !Number.isNaN(ios)) {
                update(ios);
            } else if (event.absolute) {
                handleAbsolute(event);
            }
            // A relative-only reading isn't tied to north, so it's ignored.
        };

        window.addEventListener('deviceorientationabsolute', handleAbsolute);
        window.addEventListener('deviceorientation', handleOrientation);

        const timer = window.setTimeout(() => {
            if (!received) {
                setTimedOut(true);
            }
        }, WAIT_MS);

        return () => {
            window.removeEventListener(
                'deviceorientationabsolute',
                handleAbsolute,
            );
            window.removeEventListener('deviceorientation', handleOrientation);
            window.clearTimeout(timer);
        };
    }, [listening]);

    /** Must be called from a tap (iOS only shows the prompt then). */
    const requestPermission = useCallback(async () => {
        const request = (
            DeviceOrientationEvent as unknown as OrientationPermission
        ).requestPermission;

        if (!request) {
            return;
        }

        try {
            setPermission(
                (await request()) === 'granted' ? 'granted' : 'denied',
            );
        } catch {
            setPermission('denied');
        }
    }, []);

    let status: HeadingStatus;

    if (!enabled) {
        status = 'idle';
    } else if (!supported) {
        status = 'unsupported';
    } else if (needsPermission && permission === 'unknown') {
        status = 'needs-permission';
    } else if (permission === 'denied') {
        status = 'denied';
    } else if (heading !== null) {
        status = 'active';
    } else {
        status = timedOut ? 'unavailable' : 'waiting';
    }

    return {
        status,
        heading: status === 'active' ? heading : null,
        requestPermission,
    };
}
