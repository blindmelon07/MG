import { useEffect, useState, useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** True when already running as the installed app. */
function isStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

function isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const STANDALONE_QUERY = '(display-mode: standalone)';

function subscribeStandalone(onChange: () => void) {
    const query = window.matchMedia(STANDALONE_QUERY);
    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
}

const noSubscription = () => () => {};

/**
 * "Install app" support. Android/desktop Chrome hand us an install prompt
 * to show on demand; iOS has none, so there we explain Share → Add to Home
 * Screen instead.
 */
export function useInstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
        null,
    );
    const [justInstalled, setJustInstalled] = useState(false);
    // Server render: assume a plain browser tab, then read the real thing.
    const standalone = useSyncExternalStore(
        subscribeStandalone,
        isStandalone,
        () => false,
    );
    const ios = useSyncExternalStore(noSubscription, isIos, () => false);
    const installed = standalone || justInstalled;

    useEffect(() => {
        const onPrompt = (e: Event) => {
            // Keep the browser's mini-infobar quiet; we offer our own button.
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setJustInstalled(true);
            setDeferred(null);
        };

        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const install = async () => {
        if (!deferred) {
            return;
        }

        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
    };

    return {
        /** The browser can show its install dialog right now. */
        canInstall: !installed && deferred !== null,
        /** iOS Safari, not yet installed: needs the manual Share steps. */
        showIosHint: !installed && ios && deferred === null,
        install,
    };
}
