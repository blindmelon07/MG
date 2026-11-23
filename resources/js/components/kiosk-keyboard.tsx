import { router } from '@inertiajs/react';
import { ArrowBigUp, CornerDownLeft, Delete, KeyboardOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { isHandheld } from '@/lib/device';
import { cn } from '@/lib/utils';

type Field = HTMLInputElement | HTMLTextAreaElement;

const TEXT_TYPES = new Set([
    'text',
    'search',
    'email',
    'password',
    'tel',
    'url',
    'number',
]);

/** Text boxes the keyboard types into; checkboxes, buttons etc. are left alone. */
function isField(node: EventTarget | null): node is Field {
    if (node instanceof HTMLTextAreaElement) {
        return !node.readOnly && !node.disabled;
    }

    return (
        node instanceof HTMLInputElement &&
        TEXT_TYPES.has(node.type) &&
        !node.readOnly &&
        !node.disabled
    );
}

/**
 * Change the value the way typing would, so React's onChange (and Inertia
 * forms) see it: set it through the native setter, then fire "input".
 */
function setValue(field: Field, value: string) {
    const proto =
        field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The caret, or the end of the text where the type has none (email, number). */
function selectionOf(field: Field): [number, number] {
    try {
        if (field.selectionStart !== null) {
            return [
                field.selectionStart,
                field.selectionEnd ?? field.selectionStart,
            ];
        }
    } catch {
        // Fall through: this input type doesn't expose a caret.
    }

    return [field.value.length, field.value.length];
}

function placeCaret(field: Field, at: number) {
    try {
        field.setSelectionRange(at, at);
    } catch {
        // Not supported for this input type.
    }
}

function insertText(field: Field, text: string) {
    const [start, end] = selectionOf(field);
    const next = field.value.slice(0, start) + text + field.value.slice(end);

    if (field.maxLength > 0 && next.length > field.maxLength) {
        return;
    }

    setValue(field, next);
    placeCaret(field, start + text.length);
}

function deleteBack(field: Field) {
    const [start, end] = selectionOf(field);

    if (start === end && start === 0) {
        return;
    }

    const from = start === end ? start - 1 : start;
    setValue(field, field.value.slice(0, from) + field.value.slice(end));
    placeCaret(field, from);
}

const LETTER_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const SYMBOL_ROWS = ['1234567890', '!@#$%&*()', '-_=+/:;\'"', '?,.<>[]'];

// Roughly the keyboard's height; a field lower than this gets covered.
const KEYBOARD_HEIGHT = 320;

/**
 * The kiosk's own built-in keyboard, so typing never relies on the Windows
 * on-screen keyboard (unreliable in Edge's kiosk mode: it may not appear, or
 * covers the page). It opens whenever a text box is tapped: the search
 * boxes, the chatbot and the student sign-in. Phones and tablets keep their
 * own keyboard. It docks at the bottom, or at the top
 * when the box it types into is low on the screen.
 */
export function KioskKeyboard() {
    const [field, setField] = useState<Field | null>(null);
    const [symbols, setSymbols] = useState(false);
    const [shift, setShift] = useState<'off' | 'once' | 'lock'>('off');
    const [dock, setDock] = useState<'top' | 'bottom'>('bottom');
    const repeat = useRef<{ delay?: number; tick?: number }>({});

    // Follow focus: open for text boxes, close when focus leaves them.
    useEffect(() => {
        // Phones and tablets have their own keyboard.
        if (isHandheld()) {
            return;
        }

        const open = (target: Field) => {
            // Keep Windows' own touch keyboard from opening as well.
            target.inputMode = 'none';
            setField(target);
            setShift('off');
            setSymbols(false);

            // Keep the box in view: scroll it above the keyboard, or, where
            // the page can't scroll (the home screen), dock on top instead.
            const covered = () =>
                target.getBoundingClientRect().bottom >
                window.innerHeight - KEYBOARD_HEIGHT;

            if (covered()) {
                target.scrollIntoView({ block: 'center' });
            }

            setDock(covered() ? 'top' : 'bottom');
        };

        const onFocusIn = (event: FocusEvent) => {
            if (isField(event.target)) {
                open(event.target);
            }
        };

        // A tap on a box that already has focus (after "hide keyboard", or
        // one the page focused by itself) brings the keyboard back.
        const onPointerUp = (event: PointerEvent) => {
            if (
                isField(event.target) &&
                event.target === document.activeElement
            ) {
                open(event.target);
            }
        };

        // A box the page focused itself (autofocus) before this mounted, or
        // on the page just navigated to.
        const openForFocused = () => {
            const active = document.activeElement;

            if (isField(active)) {
                open(active);
            } else {
                setField(null);
            }
        };

        const onFocusOut = () => {
            // Let focus settle first (moving between two boxes).
            window.setTimeout(() => {
                if (!isField(document.activeElement)) {
                    setField(null);
                }
            }, 0);
        };

        const stopListening = router.on('navigate', () =>
            window.setTimeout(openForFocused, 0),
        );
        const initial = window.setTimeout(openForFocused, 0);

        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        document.addEventListener('pointerup', onPointerUp);

        return () => {
            stopListening();
            window.clearTimeout(initial);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            document.removeEventListener('pointerup', onPointerUp);
        };
    }, []);

    const stopRepeat = useCallback(() => {
        window.clearTimeout(repeat.current.delay);
        window.clearInterval(repeat.current.tick);
        repeat.current = {};
    }, []);

    useEffect(() => stopRepeat, [stopRepeat]);

    if (!field) {
        return null;
    }

    const live = () => (field.isConnected ? field : null);

    const type = (key: string) => {
        const target = live();

        if (!target) {
            setField(null);

            return;
        }

        insertText(target, shift !== 'off' ? key.toUpperCase() : key);

        if (shift === 'once') {
            setShift('off');
        }
    };

    const backspace = () => {
        const target = live();

        if (target) {
            deleteBack(target);
        }
    };

    const enter = () => {
        const target = live();

        if (!target) {
            return;
        }

        if (target instanceof HTMLTextAreaElement) {
            insertText(target, '\n');

            return;
        }

        // Let the page's own Enter handling run, then submit the form.
        const handled = !target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                bubbles: true,
                cancelable: true,
            }),
        );

        if (!handled && target.form) {
            target.form.requestSubmit();
        }

        if (!target.form) {
            target.blur();
        }
    };

    const rows = symbols ? SYMBOL_ROWS : LETTER_ROWS;
    const showUpper = !symbols && shift !== 'off';

    return (
        <div
            data-kiosk-keyboard
            role="group"
            aria-label="On-screen keyboard"
            // Sheets and dialogs switch off pointer events and close on outside
            // taps; the keyboard counts as inside so typing doesn't close them.
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(event) => {
                // Keep focus (and the caret) in the text box.
                event.preventDefault();
                event.stopPropagation();
            }}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
                'fixed inset-x-0 z-[100] flex justify-center px-2 select-none',
                dock === 'bottom'
                    ? 'bottom-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]'
                    : 'top-0 pt-2',
            )}
        >
            <div className="flex w-full max-w-4xl flex-col gap-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-3 text-white shadow-2xl backdrop-blur">
                {rows.map((row, index) => (
                    <div key={index} className="flex justify-center gap-2">
                        {index === 3 && !symbols && (
                            <Key
                                wide
                                label="Shift"
                                active={shift !== 'off'}
                                onPress={() =>
                                    setShift(
                                        shift === 'off'
                                            ? 'once'
                                            : shift === 'once'
                                              ? 'lock'
                                              : 'off',
                                    )
                                }
                            >
                                <ArrowBigUp
                                    className={cn(
                                        'size-6',
                                        shift === 'lock' && 'fill-current',
                                    )}
                                />
                            </Key>
                        )}
                        {[...row].map((key) => (
                            <Key key={key} onPress={() => type(key)}>
                                {showUpper ? key.toUpperCase() : key}
                            </Key>
                        ))}
                        {index === 0 && (
                            <Key
                                wide
                                label="Backspace"
                                onPress={backspace}
                                onHoldStart={() => {
                                    stopRepeat();
                                    repeat.current.delay = window.setTimeout(
                                        () => {
                                            repeat.current.tick =
                                                window.setInterval(
                                                    backspace,
                                                    70,
                                                );
                                        },
                                        450,
                                    );
                                }}
                                onHoldEnd={stopRepeat}
                            >
                                <Delete className="size-6" />
                            </Key>
                        )}
                        {index === 2 && (
                            <Key wide accent label="Enter" onPress={enter}>
                                <CornerDownLeft className="size-6" />
                            </Key>
                        )}
                        {index === 3 && !symbols && (
                            <>
                                <Key onPress={() => type(',')}>,</Key>
                                <Key onPress={() => type('.')}>.</Key>
                            </>
                        )}
                    </div>
                ))}

                <div className="flex justify-center gap-2">
                    <Key wide onPress={() => setSymbols(!symbols)}>
                        {symbols ? 'ABC' : '?123'}
                    </Key>
                    <Key onPress={() => type('@')}>@</Key>
                    <Key
                        grow
                        label="Space"
                        onPress={() => {
                            const target = live();

                            if (target) {
                                insertText(target, ' ');
                            }
                        }}
                    >
                        space
                    </Key>
                    <Key onPress={() => type('-')}>-</Key>
                    <Key
                        wide
                        label="Hide keyboard"
                        onPress={() => {
                            live()?.blur();
                            setField(null);
                        }}
                    >
                        <KeyboardOff className="size-6" />
                    </Key>
                </div>
            </div>
        </div>
    );
}

function Key({
    children,
    onPress,
    onHoldStart,
    onHoldEnd,
    label,
    wide,
    grow,
    accent,
    active,
}: {
    children: ReactNode;
    onPress: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
    label?: string;
    wide?: boolean;
    grow?: boolean;
    accent?: boolean;
    active?: boolean;
}) {
    const start = (event: ReactPointerEvent) => {
        event.preventDefault();
        onPress();
        onHoldStart?.();
    };

    return (
        <button
            type="button"
            tabIndex={-1}
            aria-label={label}
            aria-pressed={active}
            onPointerDown={start}
            onPointerUp={onHoldEnd}
            onPointerLeave={onHoldEnd}
            onPointerCancel={onHoldEnd}
            className={cn(
                'flex h-12 min-w-0 touch-manipulation items-center justify-center rounded-xl text-xl font-semibold shadow-sm transition-colors active:scale-95',
                wide ? 'flex-[1.6]' : grow ? 'flex-[5]' : 'flex-1',
                accent
                    ? 'bg-gold-400 text-brand-950 active:bg-gold-300'
                    : active
                      ? 'bg-white text-zinc-900'
                      : wide
                        ? 'bg-zinc-600 active:bg-zinc-500'
                        : 'bg-zinc-700 active:bg-zinc-500',
            )}
        >
            {children}
        </button>
    );
}
