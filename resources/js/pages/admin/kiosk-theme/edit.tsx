import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BookOpen,
    Check,
    House,
    Map as MapIcon,
    Megaphone,
    Moon,
    RotateCcw,
    Sun,
} from 'lucide-react';
import { useState } from 'react';
import KioskThemeController from '@/actions/App/Http/Controllers/Admin/KioskThemeController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    contrastPairs,
    contrastRatio,
    kioskColorKeys,
    kioskColorLabels,
    kioskPresets,
    paletteVariables,
} from '@/lib/kiosk-theme';
import type {
    KioskColorKey,
    KioskPalette,
    KioskTheme,
} from '@/lib/kiosk-theme';
import { edit as kioskThemeEdit } from '@/routes/admin/kiosk-theme';

type Mode = 'light' | 'dark';

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

/** A swatch to pick from plus the hex code to type or paste. */
function ColorField({
    id,
    value,
    onChange,
    error,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <div className="grid gap-1">
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label="Pick a color"
                    value={isHex(value) ? value.toLowerCase() : '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <Input
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value.trim())}
                    maxLength={7}
                    spellCheck={false}
                    className="h-9 w-24 font-mono text-xs uppercase"
                />
            </div>
            <InputError message={error} />
        </div>
    );
}

/** A small kiosk screen drawn with the colors being edited. */
function Preview({ palette }: { palette: KioskPalette }) {
    return (
        <div
            style={paletteVariables(palette, '--color-')}
            className="overflow-hidden rounded-xl border border-border bg-background text-foreground"
        >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" className="size-7" />
                    <div className="leading-tight">
                        <div className="text-xs font-semibold">
                            Aemilianum College Inc.
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            Smart Information Kiosk
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 text-[10px] font-medium">
                    <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                        Home
                    </span>
                    <span className="rounded-md px-2 py-1">News</span>
                </div>
            </div>

            <div className="space-y-3 p-3">
                <div className="text-center">
                    <div className="text-sm font-semibold">
                        Welcome to Aemilianum College
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        Touch a tile below to get started.
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { icon: BookOpen, title: 'School Manual' },
                        { icon: Megaphone, title: 'Announcements' },
                    ].map((tile) => (
                        <div
                            key={tile.title}
                            className="rounded-lg border border-border bg-card p-2 text-card-foreground"
                        >
                            <tile.icon className="size-5 text-primary" />
                            <div className="mt-1 text-xs font-semibold">
                                {tile.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Policies and news
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
                    Enrollment for 2nd semester starts Nov 3.
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">
                        Main button
                    </span>
                    <span className="rounded-md bg-secondary px-3 py-1.5 text-secondary-foreground">
                        Second
                    </span>
                    <span className="rounded-md border border-border px-3 py-1.5">
                        Outline
                    </span>
                    <span className="rounded-md bg-destructive px-3 py-1.5 text-white">
                        Remove
                    </span>
                </div>
                <div className="text-[11px] text-destructive">
                    Danger text, e.g. “Closed today”
                </div>
            </div>

            {/* Phone tab bar */}
            <div className="grid grid-cols-3 border-t border-border text-[10px] font-medium">
                {[
                    { icon: House, title: 'Home', active: true },
                    { icon: MapIcon, title: 'Map', active: false },
                    { icon: Megaphone, title: 'News', active: false },
                ].map((tab) => (
                    <div
                        key={tab.title}
                        className={
                            tab.active
                                ? 'flex flex-col items-center gap-0.5 py-1.5 text-primary'
                                : 'flex flex-col items-center gap-0.5 py-1.5 text-muted-foreground'
                        }
                    >
                        <tab.icon className="size-4" />
                        {tab.title}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ContrastChecks({ palette }: { palette: KioskPalette }) {
    return (
        <ul className="space-y-1 text-xs">
            {contrastPairs.map(([text, background, label]) => {
                const valid =
                    isHex(palette[text]) && isHex(palette[background]);
                const ratio = valid
                    ? contrastRatio(palette[text], palette[background])
                    : 0;
                const ok = ratio >= 4.5;

                return (
                    <li key={label} className="flex items-center gap-2">
                        {ok ? (
                            <Check className="size-3.5 text-green-600" />
                        ) : (
                            <AlertTriangle className="size-3.5 text-amber-500" />
                        )}
                        <span className="flex-1">{label}</span>
                        <span
                            className={
                                ok
                                    ? 'text-muted-foreground tabular-nums'
                                    : 'font-medium text-amber-600 tabular-nums'
                            }
                        >
                            {valid ? `${ratio.toFixed(1)}:1` : '—'}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export default function KioskThemeEdit({
    theme: savedTheme,
    defaults,
    customized,
}: {
    theme: KioskTheme;
    defaults: KioskTheme;
    customized: boolean;
}) {
    const [theme, setTheme] = useState<KioskTheme>(savedTheme);
    const [mode, setMode] = useState<Mode>('light');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [resetting, setResetting] = useState(false);
    const changed = JSON.stringify(theme) !== JSON.stringify(savedTheme);

    const setColor = (m: Mode, key: KioskColorKey, value: string) =>
        setTheme((current) => ({
            ...current,
            [m]: { ...current[m], [key]: value },
        }));

    const save = () =>
        router.put(KioskThemeController.update.url(), theme, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => setErrors({}),
            onError: setErrors,
        });

    const reset = () =>
        router.delete(KioskThemeController.destroy.url(), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setTheme(defaults);
                setErrors({});
                setResetting(false);
            },
        });

    return (
        <>
            <Head title="Kiosk Colors" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Kiosk Colors"
                    description="Choose the colors visitors see on the kiosk and student portal. Each color has a light version and a dark version, for screens set to dark mode."
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="flex flex-col gap-6">
                        <section className="space-y-2">
                            <h3 className="text-sm font-medium">
                                Start from a preset
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { name: 'Default', theme: defaults },
                                    ...kioskPresets,
                                ].map((preset) => (
                                    <Button
                                        key={preset.name}
                                        type="button"
                                        variant="outline"
                                        onClick={() => setTheme(preset.theme)}
                                    >
                                        <span className="flex -space-x-1">
                                            {(
                                                [
                                                    'primary',
                                                    'accent',
                                                    'background',
                                                ] as const
                                            ).map((key) => (
                                                <span
                                                    key={key}
                                                    className="size-3.5 rounded-full border border-black/10"
                                                    style={{
                                                        background:
                                                            preset.theme.light[
                                                                key
                                                            ],
                                                    }}
                                                />
                                            ))}
                                        </span>
                                        {preset.name}
                                    </Button>
                                ))}
                            </div>
                        </section>

                        <section className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">
                                            Color
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Sun className="size-3.5" />{' '}
                                                Light
                                            </span>
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Moon className="size-3.5" />{' '}
                                                Dark
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kioskColorKeys.map((key) => (
                                        <tr
                                            key={key}
                                            className="border-b last:border-0"
                                        >
                                            <td className="px-3 py-2">
                                                <div className="font-medium">
                                                    {
                                                        kioskColorLabels[key]
                                                            .label
                                                    }
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {kioskColorLabels[key].hint}
                                                </div>
                                            </td>
                                            {(['light', 'dark'] as const).map(
                                                (m) => (
                                                    <td
                                                        key={m}
                                                        className="px-3 py-2"
                                                    >
                                                        <ColorField
                                                            id={`${m}-${key}`}
                                                            value={
                                                                theme[m][key]
                                                            }
                                                            onChange={(value) =>
                                                                setColor(
                                                                    m,
                                                                    key,
                                                                    value,
                                                                )
                                                            }
                                                            error={
                                                                errors[
                                                                    `${m}.${key}`
                                                                ]
                                                            }
                                                        />
                                                    </td>
                                                ),
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                disabled={processing || !changed}
                                onClick={save}
                            >
                                Save colors
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing || !changed}
                                onClick={() => {
                                    setTheme(savedTheme);
                                    setErrors({});
                                }}
                            >
                                Undo changes
                            </Button>
                            {customized && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={processing}
                                    onClick={() => setResetting(true)}
                                >
                                    <RotateCcw /> Reset to defaults
                                </Button>
                            )}
                            {changed && (
                                <span className="text-sm text-muted-foreground">
                                    Unsaved changes
                                </span>
                            )}
                        </div>
                    </div>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Preview</h3>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={mode}
                                onValueChange={(value) =>
                                    value && setMode(value as Mode)
                                }
                            >
                                <ToggleGroupItem value="light">
                                    <Sun /> Light
                                </ToggleGroupItem>
                                <ToggleGroupItem value="dark">
                                    <Moon /> Dark
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        <Preview palette={theme[mode]} />

                        <div className="space-y-2 rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                            <h3 className="text-sm font-medium">
                                Easy to read?
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Text should be at least 4.5:1 against what's
                                behind it so it reads well from a distance.
                            </p>
                            <ContrastChecks palette={theme[mode]} />
                        </div>
                    </aside>
                </div>
            </div>

            <Dialog open={resetting} onOpenChange={setResetting}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset the kiosk colors?</DialogTitle>
                        <DialogDescription>
                            The kiosk goes back to its built-in colors. Your
                            saved colors will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={processing}
                            onClick={reset}
                        >
                            Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

KioskThemeEdit.layout = {
    breadcrumbs: [{ title: 'Kiosk Colors', href: kioskThemeEdit() }],
};
