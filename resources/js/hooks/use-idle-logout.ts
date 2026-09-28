import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { logout } from '@/routes/student';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

/**
 * Signs the student out after a period with no interaction, so the next
 * person at a shared kiosk can't see their grades. Returns seconds left.
 */
export function useIdleLogout(timeoutSeconds: number): number {
    const [remaining, setRemaining] = useState(timeoutSeconds);

    useEffect(() => {
        let lastActivity = Date.now();
        let loggedOut = false;

        const reset = () => {
            lastActivity = Date.now();
            setRemaining(timeoutSeconds);
        };

        const tick = setInterval(() => {
            const left = Math.max(
                0,
                timeoutSeconds - Math.floor((Date.now() - lastActivity) / 1000),
            );
            setRemaining(left);

            if (left === 0 && !loggedOut) {
                loggedOut = true;
                router.post(logout().url);
            }
        }, 1000);

        ACTIVITY_EVENTS.forEach((event) =>
            window.addEventListener(event, reset, { passive: true }),
        );

        return () => {
            clearInterval(tick);
            ACTIVITY_EVENTS.forEach((event) =>
                window.removeEventListener(event, reset),
            );
        };
    }, [timeoutSeconds]);

    return remaining;
}
