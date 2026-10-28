/** The colors admins can change on the kiosk, mirroring App\Support\KioskTheme. */
export const kioskColorKeys = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'accent',
    'accent-foreground',
    'muted',
    'muted-foreground',
    'border',
    'destructive',
] as const;

export type KioskColorKey = (typeof kioskColorKeys)[number];
export type KioskPalette = Record<KioskColorKey, string>;
export type KioskTheme = { light: KioskPalette; dark: KioskPalette };

export const kioskColorLabels: Record<
    KioskColorKey,
    { label: string; hint: string }
> = {
    background: { label: 'Page background', hint: 'Behind everything' },
    foreground: { label: 'Text', hint: 'Headings and body text' },
    card: { label: 'Cards & panels', hint: 'Tiles, dialogs, chat box' },
    'card-foreground': { label: 'Card text', hint: 'Text on cards' },
    primary: { label: 'Main color', hint: 'Buttons, icons, active tab' },
    'primary-foreground': {
        label: 'Text on main color',
        hint: 'Button labels',
    },
    secondary: { label: 'Second buttons', hint: 'Less important buttons' },
    'secondary-foreground': {
        label: 'Text on second buttons',
        hint: 'Their labels',
    },
    accent: { label: 'Highlight', hint: 'Current menu item, hover' },
    'accent-foreground': {
        label: 'Text on highlight',
        hint: 'Current menu item text',
    },
    muted: { label: 'Subtle background', hint: 'Quiet boxes and badges' },
    'muted-foreground': { label: 'Hint text', hint: 'Dates, descriptions' },
    border: { label: 'Borders', hint: 'Lines, outlines, inputs' },
    destructive: { label: 'Danger', hint: 'Errors, remove, closed' },
};

/** Which theme variables each color fills. */
const variables: Record<KioskColorKey, string[]> = {
    background: ['background'],
    foreground: ['foreground'],
    card: ['card', 'popover'],
    'card-foreground': ['card-foreground', 'popover-foreground'],
    primary: ['primary'],
    'primary-foreground': ['primary-foreground'],
    secondary: ['secondary'],
    'secondary-foreground': ['secondary-foreground'],
    accent: ['accent'],
    'accent-foreground': ['accent-foreground'],
    muted: ['muted'],
    'muted-foreground': ['muted-foreground'],
    border: ['border', 'input', 'sidebar-border'],
    destructive: ['destructive'],
};

/**
 * CSS custom properties for a palette. Pass `prefix: '--color-'` to style
 * one element (Tailwind reads those); the default overrides the page.
 */
export function paletteVariables(
    palette: KioskPalette,
    prefix = '--',
): Record<string, string> {
    return Object.fromEntries(
        kioskColorKeys.flatMap((key) =>
            variables[key].map((name) => [`${prefix}${name}`, palette[key]]),
        ),
    );
}

function declarations(palette: KioskPalette) {
    return Object.entries(paletteVariables(palette))
        .map(([name, value]) => `${name}:${value};`)
        .join('');
}

/** A stylesheet that swaps in the kiosk colors for light and dark mode. */
export function kioskThemeCss(theme: KioskTheme) {
    return `:root{${declarations(theme.light)}}.dark{${declarations(theme.dark)}}`;
}

function luminance(hex: string) {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrastRatio(a: string, b: string) {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
}

/** Text/background pairs worth checking, with what they're for. */
export const contrastPairs: [KioskColorKey, KioskColorKey, string][] = [
    ['foreground', 'background', 'Text on the page'],
    ['card-foreground', 'card', 'Text on cards'],
    ['primary-foreground', 'primary', 'Button labels'],
    ['secondary-foreground', 'secondary', 'Second button labels'],
    ['accent-foreground', 'accent', 'Highlighted menu text'],
    ['muted-foreground', 'background', 'Hint text'],
];

/** Ready-made looks to start from. */
export const kioskPresets: { name: string; theme: KioskTheme }[] = [
    {
        name: 'Campus Blue',
        theme: {
            light: {
                background: '#f8fafc',
                foreground: '#0f172a',
                card: '#ffffff',
                'card-foreground': '#0f172a',
                primary: '#1e3a8a',
                'primary-foreground': '#ffffff',
                secondary: '#e0e7ff',
                'secondary-foreground': '#1e3a8a',
                accent: '#fef3c7',
                'accent-foreground': '#78350f',
                muted: '#f1f5f9',
                'muted-foreground': '#475569',
                border: '#e2e8f0',
                destructive: '#dc2626',
            },
            dark: {
                background: '#0f172a',
                foreground: '#f1f5f9',
                card: '#1e293b',
                'card-foreground': '#f1f5f9',
                primary: '#3b82f6',
                'primary-foreground': '#ffffff',
                secondary: '#1e3a8a',
                'secondary-foreground': '#e0e7ff',
                accent: '#fbbf24',
                'accent-foreground': '#0f172a',
                muted: '#1e293b',
                'muted-foreground': '#94a3b8',
                border: '#334155',
                destructive: '#ef4444',
            },
        },
    },
    {
        name: 'Maroon & Gold',
        theme: {
            light: {
                background: '#fffbf5',
                foreground: '#1c1917',
                card: '#ffffff',
                'card-foreground': '#1c1917',
                primary: '#7f1d1d',
                'primary-foreground': '#ffffff',
                secondary: '#fde68a',
                'secondary-foreground': '#7f1d1d',
                accent: '#fef3c7',
                'accent-foreground': '#7f1d1d',
                muted: '#f5f5f4',
                'muted-foreground': '#57534e',
                border: '#e7e5e4',
                destructive: '#dc2626',
            },
            dark: {
                background: '#1c1917',
                foreground: '#fafaf9',
                card: '#292524',
                'card-foreground': '#fafaf9',
                primary: '#fbbf24',
                'primary-foreground': '#1c1917',
                secondary: '#7f1d1d',
                'secondary-foreground': '#fef3c7',
                accent: '#44403c',
                'accent-foreground': '#fde68a',
                muted: '#292524',
                'muted-foreground': '#a8a29e',
                border: '#44403c',
                destructive: '#ef4444',
            },
        },
    },
    {
        name: 'Forest Green',
        theme: {
            light: {
                background: '#f7faf7',
                foreground: '#052e16',
                card: '#ffffff',
                'card-foreground': '#052e16',
                primary: '#166534',
                'primary-foreground': '#ffffff',
                secondary: '#dcfce7',
                'secondary-foreground': '#14532d',
                accent: '#dcfce7',
                'accent-foreground': '#14532d',
                muted: '#f0f5f0',
                'muted-foreground': '#4b5f52',
                border: '#dce5dc',
                destructive: '#dc2626',
            },
            dark: {
                background: '#071a10',
                foreground: '#ecfdf5',
                card: '#0f2a1b',
                'card-foreground': '#ecfdf5',
                primary: '#4ade80',
                'primary-foreground': '#052e16',
                secondary: '#14532d',
                'secondary-foreground': '#dcfce7',
                accent: '#14532d',
                'accent-foreground': '#dcfce7',
                muted: '#0f2a1b',
                'muted-foreground': '#86a893',
                border: '#1f3d2b',
                destructive: '#ef4444',
            },
        },
    },
];
