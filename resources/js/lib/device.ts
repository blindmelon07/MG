/** Phones and tablets carry GPS and move with the visitor; kiosks don't. */
export function isHandheld() {
    return (
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );
}
