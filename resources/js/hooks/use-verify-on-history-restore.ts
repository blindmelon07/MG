import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

let lastPopstate = 0;

if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        lastPopstate = Date.now();
    });
}

function restoredFromHistory(): boolean {
    const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;

    return (
        Date.now() - lastPopstate < 1000 ||
        (Date.now() - performance.timeOrigin < 5000 &&
            navigation?.type === 'back_forward')
    );
}

/**
 * Inertia can re-show a page from browser history without asking the server,
 * and without HTTPS it can't encrypt that history. On a shared kiosk that would
 * let the next person press Back and see the previous student's grades. When a
 * page comes back from history, keep it hidden until the server confirms the
 * session is still signed in; if it isn't, the reload redirects away.
 */
export function useVerifyOnHistoryRestore(): boolean {
    const [verified, setVerified] = useState(() => !restoredFromHistory());

    useEffect(() => {
        if (verified) {
            return;
        }

        router.reload({ onSuccess: () => setVerified(true) });
    }, [verified]);

    return verified;
}
