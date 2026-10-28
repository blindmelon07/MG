import type { KioskTheme } from '@/lib/kiosk-theme';
import type { Auth } from '@/types/auth';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            kioskTheme: KioskTheme | null;
            /** The school year staff are viewing; null for other visitors. */
            schoolYear: {
                selected: string;
                current: string;
                options: string[];
            } | null;
            [key: string]: unknown;
        };
    }
}
