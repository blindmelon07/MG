import { usePage } from '@inertiajs/react';
import { kioskThemeCss } from '@/lib/kiosk-theme';

/** Applies the colors an admin picked for the kiosk, if any. */
export function KioskThemeStyle() {
    const { kioskTheme } = usePage().props;

    if (!kioskTheme) {
        return null;
    }

    return <style>{kioskThemeCss(kioskTheme)}</style>;
}
