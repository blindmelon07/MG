import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * On a kiosk PC, keep visitors inside the kiosk: links to other websites,
 * phone and email links, new windows and the right-click menu do nothing.
 * (The PC itself is locked down too; see docs/kiosk-setup.md.)
 */
export function useKioskLockdown(enabled: boolean) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const blockLinks = (event: MouseEvent) => {
            const link = (event.target as Element | null)?.closest?.('a[href]');

            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }

            const url = new URL(link.href, window.location.href);
            const leavesKiosk =
                url.origin !== window.location.origin ||
                link.target === '_blank' ||
                link.hasAttribute('download');

            if (leavesKiosk) {
                event.preventDefault();
                event.stopPropagation();
                toast("That link can't be opened on this kiosk.");
            }
        };
        const blockMenu = (event: Event) => event.preventDefault();
        const originalOpen = window.open;
        window.open = () => null;

        document.addEventListener('click', blockLinks, true);
        document.addEventListener('contextmenu', blockMenu);

        return () => {
            window.open = originalOpen;
            document.removeEventListener('click', blockLinks, true);
            document.removeEventListener('contextmenu', blockMenu);
        };
    }, [enabled]);
}
