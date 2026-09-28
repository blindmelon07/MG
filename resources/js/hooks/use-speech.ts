import { useCallback, useEffect, useState } from 'react';

const MUTED_KEY = 'campus-nav-muted';

function readMuted(): boolean {
    try {
        return window.localStorage.getItem(MUTED_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Speaks navigation prompts with the phone's built-in voice. Nothing is sent
 * to any service. iOS only allows speech that starts from a tap, so call
 * `speak` once from the button that starts navigation.
 */
export function useSpeech() {
    const supported =
        typeof window !== 'undefined' && 'speechSynthesis' in window;
    const [muted, setMutedState] = useState(readMuted);

    const setMuted = useCallback((next: boolean) => {
        setMutedState(next);

        try {
            window.localStorage.setItem(MUTED_KEY, next ? '1' : '0');
        } catch {
            // Private mode: the choice just isn't remembered.
        }

        if (next && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }, []);

    const speak = useCallback(
        (text: string) => {
            if (!supported || muted) {
                return;
            }

            // A newer prompt replaces one still being spoken.
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = navigator.language?.startsWith('en')
                ? navigator.language
                : 'en-US';
            window.speechSynthesis.speak(utterance);
        },
        [supported, muted],
    );

    useEffect(() => {
        return () => {
            if (supported) {
                window.speechSynthesis.cancel();
            }
        };
    }, [supported]);

    return { supported, muted, setMuted, speak };
}
