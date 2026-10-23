import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Gate anything
 * that depends on browser-only APIs (GPS, compass, …) behind it so the first
 * client render matches the server's HTML.
 */
export function useHydrated() {
    return useSyncExternalStore(
        subscribeNothing,
        () => true,
        () => false,
    );
}
