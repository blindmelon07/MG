import { router } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    DoorOpen,
    ImagePlus,
    MapPin,
    MousePointer2,
    RectangleHorizontal,
    RotateCw,
    Route,
    Trash2,
    Undo2,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import FloorPlanController from '@/actions/App/Http/Controllers/Admin/FloorPlanController';
import { CampusMap } from '@/components/campus-map';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { MapPoint } from '@/lib/campus-route';
import {
    ROOM_KINDS,
    SIDES,
    doorPoint,
    indoorRoute,
    reachableRooms,
} from '@/lib/floor-plans';
import type {
    Entrance,
    FloorPlan,
    Rect,
    Room,
    RoomKind,
    Side,
} from '@/lib/floor-plans';
import { cn } from '@/lib/utils';

export type EditorLocation = {
    id: number;
    name: string;
    description: string | null;
    x: number;
    y: number;
};

export type EditorOffice = {
    id: number;
    name: string;
    floor_room: string | null;
};

export type EditorPlan = FloorPlan & { id: number };

type Layer = 'room' | 'hall' | 'entrance';
type Tool = 'select' | Layer;
type Selection = { layer: Layer; index: number } | null;
type Shapes = { rooms: Room[]; halls: Rect[]; entrances: Entrance[] };
type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Drag =
    | {
          mode: 'draw';
          layer: 'room' | 'hall';
          start: MapPoint;
          current: MapPoint;
      }
    | {
          mode: 'move';
          layer: Layer;
          index: number;
          start: MapPoint;
          before: Shapes;
          moved: boolean;
      }
    | {
          mode: 'resize';
          layer: 'room' | 'hall';
          index: number;
          corner: Corner;
          before: Shapes;
          moved: boolean;
      };

// New plans traced over a picture are this many units across; without a
// picture, one unit is a metre.
const PICTURE_WIDTH = 100;
const MIN_SIZE = 0.5;
// Same as the kiosk's routing grid (floor-plans.ts).
const CELL = 0.5;

const ROOM_FILL: Record<RoomKind, string> = {
    office: '#f5d77a',
    classroom: '#f1e4b8',
    lab: '#e9d8a6',
    stairs: '#c8c2b4',
    open: '#9cc58a',
    outside: '#9cc58a',
};

const SIDE_LABEL: Record<Side, string> = {
    north: 'North (up)',
    south: 'South (down)',
    east: 'East (right)',
    west: 'West (left)',
};

const OPPOSITE: Record<Side, Side> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
};

// A quarter turn clockwise: what was north now faces east.
const TURNED: Record<Side, Side> = {
    north: 'east',
    east: 'south',
    south: 'west',
    west: 'north',
};

const TOOLS: {
    value: Tool;
    label: string;
    Icon: LucideIcon;
    shortcut: string;
    hint: string;
}[] = [
    {
        value: 'select',
        label: 'Select',
        Icon: MousePointer2,
        shortcut: 'V',
        hint: 'Click a shape to edit it. Drag to move, drag a corner to resize. Delete removes it.',
    },
    {
        value: 'room',
        label: 'Room',
        Icon: RectangleHorizontal,
        shortcut: 'R',
        hint: 'Drag over a room on the picture to draw it, then name it and pick the side its door opens onto.',
    },
    {
        value: 'hall',
        label: 'Hallway',
        Icon: Route,
        shortcut: 'H',
        hint: 'Drag along each hallway. Visitors can only walk on hallways, so they must touch every door and entrance, and each other.',
    },
    {
        value: 'entrance',
        label: 'Entrance',
        Icon: DoorOpen,
        shortcut: 'E',
        hint: 'Click where people walk in, at the end of a hallway on the building’s outer edge.',
    },
];

const round = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

function slugify(text: string, fallback: string) {
    return (
        text
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || fallback
    );
}

function uniqueKey(base: string, taken: Set<string>) {
    let key = base;

    for (let n = 2; taken.has(key); n++) {
        key = `${base}-${n}`;
    }

    return key;
}

function rectFrom(a: MapPoint, b: MapPoint): Rect {
    return {
        x: round(Math.min(a.x, b.x)),
        y: round(Math.min(a.y, b.y)),
        w: round(Math.abs(b.x - a.x)),
        d: round(Math.abs(b.y - a.y)),
    };
}

function inRect(p: MapPoint, r: Rect, pad = 0) {
    return (
        p.x >= r.x - pad &&
        p.x <= r.x + r.w + pad &&
        p.y >= r.y - pad &&
        p.y <= r.y + r.d + pad
    );
}

/** The way someone faces walking in, from the plan edge they're nearest. */
function inwardFrom(p: MapPoint, width: number, depth: number): Side {
    const options: [number, Side][] = [
        [p.y, 'south'],
        [depth - p.y, 'north'],
        [p.x, 'east'],
        [width - p.x, 'west'],
    ];

    return options.sort((a, b) => a[0] - b[0])[0][1];
}

/** The side of a new room that opens onto a hallway, if one does. */
function doorFacingHall(rect: Rect, halls: Rect[]): Side {
    let best: Side = 'south';
    let bestDistance = Infinity;

    for (const side of SIDES) {
        const door = doorPoint({ ...rect, door: side } as Room);
        const out = {
            north: { x: 0, y: -CELL },
            south: { x: 0, y: CELL },
            east: { x: CELL, y: 0 },
            west: { x: -CELL, y: 0 },
        }[side];
        const p = { x: door.x + out.x, y: door.y + out.y };

        for (const hall of halls) {
            const dx = Math.max(hall.x - p.x, 0, p.x - (hall.x + hall.w));
            const dy = Math.max(hall.y - p.y, 0, p.y - (hall.y + hall.d));
            const distance = Math.hypot(dx, dy);

            if (distance < bestDistance) {
                best = side;
                bestDistance = distance;
            }
        }
    }

    return best;
}

/** The doorway: the middle 40% of the door wall. */
function doorSegment(room: Room): [MapPoint, MapPoint] {
    const c = doorPoint(room);
    const half =
        (room.door === 'north' || room.door === 'south' ? room.w : room.d) *
        0.2;

    return room.door === 'north' || room.door === 'south'
        ? [
              { x: c.x - half, y: c.y },
              { x: c.x + half, y: c.y },
          ]
        : [
              { x: c.x, y: c.y - half },
              { x: c.x, y: c.y + half },
          ];
}

function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

/** The picture turned a quarter clockwise, as a new upload. */
async function rotatedImage(url: string, name: string) {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No canvas');
    }

    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );

    if (!blob) {
        throw new Error('Could not rotate');
    }

    return new File([blob], `${name.replace(/\.\w+$/, '')}.jpg`, {
        type: 'image/jpeg',
    });
}

/** A number box that lets you type freely and reports valid numbers. */
function NumberField({
    label,
    value,
    onChange,
    step = 0.1,
    suffix,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    suffix?: string;
}) {
    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);

    return (
        <label className="grid gap-1 text-xs font-medium">
            <span className="text-muted-foreground">
                {label}
                {suffix && ` (${suffix})`}
            </span>
            <Input
                type="number"
                step={step}
                className="h-8 tabular-nums"
                value={focused ? text : String(round(value))}
                onFocus={() => {
                    setText(String(round(value)));
                    setFocused(true);
                }}
                onBlur={() => setFocused(false)}
                onChange={(e) => {
                    setText(e.target.value);
                    const next = parseFloat(e.target.value);

                    if (Number.isFinite(next)) {
                        onChange(next);
                    }
                }}
            />
        </label>
    );
}

function Panel({
    title,
    children,
    aside,
}: {
    title: string;
    children: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <section className="space-y-3 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

export function FloorPlanEditor({
    plan,
    locations,
    offices,
}: {
    /** The saved plan; omitted when drawing a new one. */
    plan?: EditorPlan;
    locations: EditorLocation[];
    offices: EditorOffice[];
}) {
    const defaultSite = (l: EditorLocation | null | undefined) =>
        l
            ? {
                  x0: round(l.x - 5),
                  y0: round(l.y - 3.5),
                  x1: round(l.x + 5),
                  y1: round(l.y + 3.5),
              }
            : { x0: 45, y0: 45, x1: 55, y1: 52 };

    const [locationId, setLocationId] = useState(
        plan
            ? String(plan.campusLocationId)
            : locations[0]
              ? String(locations[0].id)
              : '',
    );
    const location = locations.find((l) => String(l.id) === locationId);
    const [floor, setFloor] = useState(plan?.floor ?? 'Ground floor');
    const [width, setWidth] = useState(plan?.width ?? 60);
    const [depth, setDepth] = useState(plan?.depth ?? 40);
    const [metersPerUnit, setMetersPerUnit] = useState(
        plan?.metersPerUnit ?? 1,
    );
    const [site, setSite] = useState(plan?.site ?? defaultSite(location));
    const [siteTouched, setSiteTouched] = useState(Boolean(plan));
    const [placing, setPlacing] = useState<{ first: MapPoint | null } | null>(
        null,
    );

    const [imageUrl, setImageUrl] = useState<string | null>(
        plan?.imageUrl ?? null,
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [imageOpacity, setImageOpacity] = useState(0.8);
    const [rotating, setRotating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [shapes, setShapes] = useState<Shapes>({
        rooms: plan?.rooms ?? [],
        halls: plan?.halls ?? [],
        entrances: plan?.entrances ?? [],
    });
    const [history, setHistory] = useState<Shapes[]>([]);
    // Keys of rooms drawn since the last save: nothing points at them yet,
    // so they follow the room's name.
    const newKeys = useRef(new Set<string>());

    const [tool, setTool] = useState<Tool>('select');
    const [selection, setSelection] = useState<Selection>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [snap, setSnap] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const svgRef = useRef<SVGSVGElement>(null);
    const [canvasPx, setCanvasPx] = useState(800);
    // Plan units per screen pixel, to keep strokes and labels a steady size.
    const unit = width / Math.max(canvasPx, 1);

    useEffect(() => {
        const svg = svgRef.current;

        if (!svg) {
            return;
        }

        const observer = new ResizeObserver(() =>
            setCanvasPx(svg.getBoundingClientRect().width),
        );
        observer.observe(svg);

        return () => observer.disconnect();
    }, []);

    // Object URLs for chosen pictures are freed when replaced.
    useEffect(() => {
        if (!imageUrl?.startsWith('blob:')) {
            return;
        }

        return () => URL.revokeObjectURL(imageUrl);
    }, [imageUrl]);

    // Don't lose an afternoon of tracing to a stray click.
    useEffect(() => {
        if (!dirty) {
            return;
        }

        const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener('beforeunload', onBeforeUnload);
        const stop = router.on('before', (event) => {
            // Hovering a prefetching link isn't leaving.
            if (
                event.detail.visit.method === 'get' &&
                !event.detail.visit.prefetch &&
                !window.confirm(
                    'Leave without saving your changes to this floor plan?',
                )
            ) {
                event.preventDefault();
            }
        });

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            stop();
        };
    }, [dirty]);

    const touch = () => setDirty(true);

    /** Change the shapes as one undoable step. */
    const commit = (next: Shapes) => {
        setHistory((h) => [...h.slice(-49), shapes]);
        setShapes(next);
        touch();
    };

    /** Change the shapes while typing in a field (not its own undo step). */
    const edit = (next: Shapes) => {
        setShapes(next);
        touch();
    };

    const undo = () => {
        const previous = history[history.length - 1];

        if (!previous) {
            return;
        }

        setHistory(history.slice(0, -1));
        setShapes(previous);
        setSelection(null);
        touch();
    };

    const removeSelected = () => {
        if (!selection) {
            return;
        }

        const { layer, index } = selection;
        commit({
            rooms:
                layer === 'room'
                    ? shapes.rooms.filter((_, i) => i !== index)
                    : shapes.rooms,
            halls:
                layer === 'hall'
                    ? shapes.halls.filter((_, i) => i !== index)
                    : shapes.halls,
            entrances:
                layer === 'entrance'
                    ? shapes.entrances.filter((_, i) => i !== index)
                    : shapes.entrances,
        });
        setSelection(null);
    };

    const nudge = (dx: number, dy: number) => {
        if (!selection) {
            return;
        }

        const { layer, index } = selection;

        if (layer === 'entrance') {
            edit({
                ...shapes,
                entrances: shapes.entrances.map((e, i) =>
                    i === index
                        ? {
                              ...e,
                              at: {
                                  x: round(clamp(e.at.x + dx, 0, width)),
                                  y: round(clamp(e.at.y + dy, 0, depth)),
                              },
                          }
                        : e,
                ),
            });

            return;
        }

        const move = <T extends Rect>(r: T): T => ({
            ...r,
            x: round(clamp(r.x + dx, 0, width - r.w)),
            y: round(clamp(r.y + dy, 0, depth - r.d)),
        });
        edit(
            layer === 'room'
                ? {
                      ...shapes,
                      rooms: shapes.rooms.map((r, i) =>
                          i === index ? move(r) : r,
                      ),
                  }
                : {
                      ...shapes,
                      halls: shapes.halls.map((h, i) =>
                          i === index ? move(h) : h,
                      ),
                  },
        );
    };

    // Keyboard: tool shortcuts, delete, undo, nudge.
    const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

    useEffect(() => {
        keyHandlerRef.current = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;

            if (
                target?.closest(
                    'input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"], [role="dialog"]',
                )
            ) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();

                return;
            }

            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }

            const step = e.shiftKey ? 1 : 0.1;

            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (selection) {
                        e.preventDefault();
                        removeSelected();
                    }

                    return;
                case 'Escape':
                    setDrag(null);
                    setSelection(null);
                    setTool('select');
                    setPlacing(null);

                    return;
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'ArrowUp':
                case 'ArrowDown':
                    if (selection) {
                        e.preventDefault();
                        nudge(
                            e.key === 'ArrowLeft'
                                ? -step
                                : e.key === 'ArrowRight'
                                  ? step
                                  : 0,
                            e.key === 'ArrowUp'
                                ? -step
                                : e.key === 'ArrowDown'
                                  ? step
                                  : 0,
                        );
                    }

                    return;
            }

            const picked = TOOLS.find(
                (t) => t.shortcut.toLowerCase() === e.key.toLowerCase(),
            );

            if (picked) {
                setTool(picked.value);
            }
        };
    });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Snapping: to the plan's edges and other shapes' edges when close, so
    // doors meet hallways exactly; otherwise to a tenth of a unit.
    const tolerance = Math.max(8 * unit, Math.max(width, depth) * 0.004);
    const edgesExcept = (skip: { layer: Layer; index: number } | null) => {
        const xs = [0, width];
        const ys = [0, depth];
        const add = (r: Rect, layer: Layer, index: number) => {
            if (skip && skip.layer === layer && skip.index === index) {
                return;
            }

            xs.push(r.x, r.x + r.w);
            ys.push(r.y, r.y + r.d);
        };
        shapes.rooms.forEach((r, i) => add(r, 'room', i));
        shapes.halls.forEach((h, i) => add(h, 'hall', i));

        return { xs, ys };
    };
    const snapTo = (v: number, candidates: number[]) => {
        if (!snap) {
            return round1(v);
        }

        let best = round1(v);
        let bestDistance = tolerance;

        for (const c of candidates) {
            const distance = Math.abs(c - v);

            if (distance < bestDistance) {
                best = c;
                bestDistance = distance;
            }
        }

        return round(best);
    };
    /** Snap a span (start, size) by whichever of its two ends is closer. */
    const snapSpan = (start: number, size: number, candidates: number[]) => {
        if (!snap) {
            return round1(start);
        }

        const a = snapTo(start, candidates);
        const b = snapTo(start + size, candidates) - size;
        const da = Math.abs(a - start);
        const db = Math.abs(b - start);

        return round(da <= db ? a : b);
    };

    const toPlan = (e: ReactPointerEvent): MapPoint => {
        const r = svgRef.current!.getBoundingClientRect();

        return {
            x: clamp(((e.clientX - r.left) / r.width) * width, 0, width),
            y: clamp(((e.clientY - r.top) / r.height) * depth, 0, depth),
        };
    };

    const onCanvasDown = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (e.button !== 0) {
            return;
        }

        const p = toPlan(e);
        const { xs, ys } = edgesExcept(null);
        const snapped = { x: snapTo(p.x, xs), y: snapTo(p.y, ys) };

        if (tool === 'room' || tool === 'hall') {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({
                mode: 'draw',
                layer: tool,
                start: snapped,
                current: snapped,
            });

            return;
        }

        if (tool === 'entrance') {
            const inward = inwardFrom(snapped, width, depth);
            const side = OPPOSITE[inward];
            const key = uniqueKey(
                side,
                new Set(shapes.entrances.map((x) => x.key)),
            );
            commit({
                ...shapes,
                entrances: [
                    ...shapes.entrances,
                    {
                        key,
                        name: `the ${side} entrance`,
                        at: snapped,
                        inward,
                    },
                ],
            });
            setSelection({
                layer: 'entrance',
                index: shapes.entrances.length,
            });
            setTool('select');

            return;
        }

        setSelection(null);
    };

    const startMove = (e: ReactPointerEvent, layer: Layer, index: number) => {
        if (tool !== 'select' || e.button !== 0) {
            return;
        }

        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        setSelection({ layer, index });
        setDrag({
            mode: 'move',
            layer,
            index,
            start: toPlan(e),
            before: shapes,
            moved: false,
        });
    };

    const startResize = (
        e: ReactPointerEvent,
        layer: 'room' | 'hall',
        index: number,
        corner: Corner,
    ) => {
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        setDrag({
            mode: 'resize',
            layer,
            index,
            corner,
            before: shapes,
            moved: false,
        });
    };

    const onCanvasMove = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (!drag) {
            return;
        }

        const p = toPlan(e);

        if (drag.mode === 'draw') {
            const { xs, ys } = edgesExcept(null);
            setDrag({
                ...drag,
                current: { x: snapTo(p.x, xs), y: snapTo(p.y, ys) },
            });

            return;
        }

        const { xs, ys } = edgesExcept({
            layer: drag.layer,
            index: drag.index,
        });
        const before = drag.before;

        if (drag.mode === 'move') {
            const dx = p.x - drag.start.x;
            const dy = p.y - drag.start.y;

            if (drag.layer === 'entrance') {
                const e0 = before.entrances[drag.index];
                const at = {
                    x: snapTo(clamp(e0.at.x + dx, 0, width), xs),
                    y: snapTo(clamp(e0.at.y + dy, 0, depth), ys),
                };
                setShapes({
                    ...shapes,
                    entrances: shapes.entrances.map((x, i) =>
                        i === drag.index ? { ...x, at } : x,
                    ),
                });
            } else {
                const r0 =
                    drag.layer === 'room'
                        ? before.rooms[drag.index]
                        : before.halls[drag.index];
                const x = clamp(snapSpan(r0.x + dx, r0.w, xs), 0, width - r0.w);
                const y = clamp(snapSpan(r0.y + dy, r0.d, ys), 0, depth - r0.d);
                setShapes(
                    drag.layer === 'room'
                        ? {
                              ...shapes,
                              rooms: shapes.rooms.map((r, i) =>
                                  i === drag.index ? { ...r, x, y } : r,
                              ),
                          }
                        : {
                              ...shapes,
                              halls: shapes.halls.map((h, i) =>
                                  i === drag.index ? { ...h, x, y } : h,
                              ),
                          },
                );
            }

            if (!drag.moved && Math.hypot(dx, dy) > unit * 2) {
                setDrag({ ...drag, moved: true });
            }

            return;
        }

        // Resize: the dragged corner follows the pointer; the opposite stays.
        const r0 =
            drag.layer === 'room'
                ? before.rooms[drag.index]
                : before.halls[drag.index];
        let x0 = r0.x;
        let y0 = r0.y;
        let x1 = r0.x + r0.w;
        let y1 = r0.y + r0.d;
        const sx = snapTo(p.x, xs);
        const sy = snapTo(p.y, ys);

        if (drag.corner === 'nw' || drag.corner === 'sw') {
            x0 = Math.min(sx, x1 - MIN_SIZE);
        } else {
            x1 = Math.max(sx, x0 + MIN_SIZE);
        }

        if (drag.corner === 'nw' || drag.corner === 'ne') {
            y0 = Math.min(sy, y1 - MIN_SIZE);
        } else {
            y1 = Math.max(sy, y0 + MIN_SIZE);
        }

        const rect = {
            x: round(x0),
            y: round(y0),
            w: round(x1 - x0),
            d: round(y1 - y0),
        };
        setShapes(
            drag.layer === 'room'
                ? {
                      ...shapes,
                      rooms: shapes.rooms.map((r, i) =>
                          i === drag.index ? { ...r, ...rect } : r,
                      ),
                  }
                : {
                      ...shapes,
                      halls: shapes.halls.map((h, i) =>
                          i === drag.index ? rect : h,
                      ),
                  },
        );

        if (!drag.moved) {
            setDrag({ ...drag, moved: true });
        }
    };

    const onCanvasUp = () => {
        if (!drag) {
            return;
        }

        if (drag.mode === 'draw') {
            const rect = rectFrom(drag.start, drag.current);

            if (rect.w >= MIN_SIZE && rect.d >= MIN_SIZE) {
                if (drag.layer === 'room') {
                    const name = `Room ${shapes.rooms.length + 1}`;
                    const key = uniqueKey(
                        slugify(name, 'room'),
                        new Set(shapes.rooms.map((r) => r.key)),
                    );
                    newKeys.current.add(key);
                    commit({
                        ...shapes,
                        rooms: [
                            ...shapes.rooms,
                            {
                                ...rect,
                                key,
                                name,
                                kind: 'office',
                                door: doorFacingHall(rect, shapes.halls),
                            },
                        ],
                    });
                    setSelection({ layer: 'room', index: shapes.rooms.length });
                } else {
                    commit({ ...shapes, halls: [...shapes.halls, rect] });
                    setSelection({ layer: 'hall', index: shapes.halls.length });
                }
            }
        } else if (drag.moved) {
            setHistory((h) => [...h.slice(-49), drag.before]);
            touch();
        }

        setDrag(null);
    };

    const renameRoom = (index: number, name: string) => {
        const room = shapes.rooms[index];
        let key = room.key;

        // Rooms drawn since the last save follow their name; saved ones
        // keep their key, since offices in the Directory point at it.
        if (newKeys.current.has(room.key)) {
            const taken = new Set(
                shapes.rooms.filter((_, i) => i !== index).map((r) => r.key),
            );
            key = uniqueKey(slugify(name, 'room'), taken);
            newKeys.current.delete(room.key);
            newKeys.current.add(key);
        }

        edit({
            ...shapes,
            rooms: shapes.rooms.map((r, i) =>
                i === index ? { ...r, name, key } : r,
            ),
        });
    };

    const updateRoom = (index: number, patch: Partial<Room>) =>
        edit({
            ...shapes,
            rooms: shapes.rooms.map((r, i) =>
                i === index ? { ...r, ...patch } : r,
            ),
        });
    const updateHall = (index: number, patch: Partial<Rect>) =>
        edit({
            ...shapes,
            halls: shapes.halls.map((h, i) =>
                i === index ? { ...h, ...patch } : h,
            ),
        });
    const updateEntrance = (index: number, patch: Partial<Entrance>) =>
        edit({
            ...shapes,
            entrances: shapes.entrances.map((x, i) =>
                i === index ? { ...x, ...patch } : x,
            ),
        });

    const chooseImage = async (file: File) => {
        const url = URL.createObjectURL(file);

        try {
            const img = await loadImage(url);
            const nextWidth =
                shapes.rooms.length || shapes.halls.length
                    ? width
                    : PICTURE_WIDTH;

            if (!(shapes.rooms.length || shapes.halls.length)) {
                // About 50 m across until the real size is entered.
                setMetersPerUnit(0.5);
            }

            setWidth(nextWidth);
            setDepth(round((nextWidth * img.naturalHeight) / img.naturalWidth));
            setImageFile(file);
            setImageUrl(url);
            setRemoveImage(false);
            touch();
        } catch {
            URL.revokeObjectURL(url);
            window.alert("That file couldn't be opened as a picture.");
        }
    };

    /** Turn the picture and everything drawn on it a quarter clockwise. */
    const rotate = async () => {
        setRotating(true);

        try {
            if (imageUrl) {
                const file = await rotatedImage(
                    imageUrl,
                    imageFile?.name ?? 'floor-plan.jpg',
                );
                setImageFile(file);
                setImageUrl(URL.createObjectURL(file));
                setRemoveImage(false);
            }

            const D = depth;
            const turnRect = <T extends Rect>(r: T): T => ({
                ...r,
                x: round(D - (r.y + r.d)),
                y: r.x,
                w: r.d,
                d: r.w,
            });
            commit({
                rooms: shapes.rooms.map((r) => ({
                    ...turnRect(r),
                    door: TURNED[r.door],
                })),
                halls: shapes.halls.map(turnRect),
                entrances: shapes.entrances.map((x) => ({
                    ...x,
                    at: { x: round(D - x.at.y), y: x.at.x },
                    inward: TURNED[x.inward],
                })),
            });
            setWidth(depth);
            setDepth(width);
        } catch {
            window.alert("Couldn't rotate the picture.");
        } finally {
            setRotating(false);
        }
    };

    // What the kiosk would get, for the checks and the route preview.
    const deferredShapes = useDeferredValue(shapes);
    const preview: FloorPlan = useMemo(
        () => ({
            campusLocationId: Number(locationId),
            building: location?.name ?? '',
            floor,
            width,
            depth,
            metersPerUnit,
            site,
            ...deferredShapes,
        }),
        [
            locationId,
            location?.name,
            floor,
            width,
            depth,
            metersPerUnit,
            site,
            deferredShapes,
        ],
    );
    const reachable = useMemo(() => reachableRooms(preview), [preview]);
    const destinations = preview.rooms.filter(
        (r) => r.kind !== 'stairs' && r.kind !== 'open' && r.kind !== 'outside',
    );
    const unreachable =
        preview.entrances.length > 0
            ? destinations.filter((r) => !reachable.has(r.key))
            : [];
    const strandedEntrances = preview.entrances.filter(
        (x) => !preview.halls.some((h) => inRect(x.at, h, CELL)),
    );

    const selectedRoom =
        selection?.layer === 'room' ? shapes.rooms[selection.index] : null;
    const routePreview = useMemo(() => {
        if (!selectedRoom || preview.entrances.length === 0) {
            return null;
        }

        const room = preview.rooms.find((r) => r.key === selectedRoom.key);

        if (!room) {
            return null;
        }

        let best: MapPoint[] | null = null;
        let bestLength = Infinity;

        for (const entrance of preview.entrances) {
            const points = indoorRoute(preview, entrance, room);

            if (!points) {
                continue;
            }

            const length = points
                .slice(1)
                .reduce(
                    (sum, p, i) =>
                        sum + Math.hypot(p.x - points[i].x, p.y - points[i].y),
                    0,
                );

            if (length < bestLength) {
                best = points;
                bestLength = length;
            }
        }

        return best;
    }, [selectedRoom, preview]);

    const officesByRoom = useMemo(() => {
        const map = new Map<string, string[]>();

        for (const office of offices) {
            if (office.floor_room) {
                map.set(office.floor_room, [
                    ...(map.get(office.floor_room) ?? []),
                    office.name,
                ]);
            }
        }

        return map;
    }, [offices]);

    const changeBuilding = (id: string) => {
        setLocationId(id);

        if (!siteTouched) {
            setSite(defaultSite(locations.find((l) => String(l.id) === id)));
        }

        touch();
    };

    const save = () => {
        const data: Record<string, unknown> = {
            campus_location_id: locationId,
            floor,
            width,
            depth,
            meters_per_unit: metersPerUnit,
            site_x0: site.x0,
            site_y0: site.y0,
            site_x1: site.x1,
            site_y1: site.y1,
            rooms: shapes.rooms,
            halls: shapes.halls,
            entrances: shapes.entrances,
            remove_image: removeImage,
        };

        if (imageFile) {
            data.image = imageFile;
        }

        if (plan) {
            data._method = 'put';
        }

        router.post(
            plan
                ? FloorPlanController.update.url(plan.id)
                : FloorPlanController.store.url(),
            data as never,
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (e) => setErrors(e as Record<string, string>),
                onSuccess: (page) => {
                    const saved = (page.props as { plan?: EditorPlan }).plan;
                    setErrors({});
                    setDirty(false);
                    setImageFile(null);
                    setRemoveImage(false);
                    setImageUrl(saved?.imageUrl ?? null);
                    newKeys.current.clear();
                },
            },
        );
    };

    const errorList = [...new Set(Object.values(errors))];
    const activeTool = TOOLS.find((t) => t.value === tool)!;
    const draft =
        drag?.mode === 'draw' ? rectFrom(drag.start, drag.current) : null;
    const selectedRect =
        selection?.layer === 'room'
            ? shapes.rooms[selection.index]
            : selection?.layer === 'hall'
              ? shapes.halls[selection.index]
              : null;
    const label = (text: string, maxWidth: number) => {
        const fits = Math.max(3, Math.floor(maxWidth / (unit * 6.2)));

        return text.length > fits ? `${text.slice(0, fits - 1)}…` : text;
    };
    const realWidth = round(width * metersPerUnit);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sidebar-border/70 bg-muted/40 px-4 py-3 dark:border-sidebar-border">
                <p className="text-sm text-muted-foreground">
                    {dirty
                        ? 'You have unsaved changes.'
                        : plan
                          ? 'All changes saved.'
                          : 'Upload a picture of the floor sign, then trace it.'}
                </p>
                <Button onClick={save} disabled={processing || !locationId}>
                    {processing ? 'Saving…' : 'Save floor plan'}
                </Button>
            </div>

            {errorList.length > 0 && (
                <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                    <p className="font-medium">
                        The floor plan couldn&apos;t be saved:
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                        {errorList.slice(0, 6).map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-w-0 space-y-3">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            role="toolbar"
                            aria-label="Drawing tools"
                            className="flex gap-1 rounded-lg bg-muted p-1"
                        >
                            {TOOLS.map(({ value, label, Icon, shortcut }) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={tool === value}
                                    title={`${label} (${shortcut})`}
                                    onClick={() => setTool(value)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                        tool === value
                                            ? 'bg-background shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={undo}
                            disabled={history.length === 0}
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 /> Undo
                        </Button>
                        <label className="ml-auto flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={snap}
                                onCheckedChange={(v) => setSnap(v === true)}
                            />
                            Snap to edges
                        </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {activeTool.hint}
                    </p>

                    {/* Canvas */}
                    <div
                        className="relative mx-auto w-full overflow-hidden rounded-xl border border-sidebar-border/70 bg-white dark:border-sidebar-border dark:bg-neutral-900"
                        style={{
                            aspectRatio: `${width} / ${depth}`,
                            maxWidth: `calc(72vh * ${width / depth})`,
                        }}
                    >
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt="Floor plan picture"
                                draggable={false}
                                className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
                                style={{ opacity: imageOpacity }}
                            />
                        )}
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${width} ${depth}`}
                            preserveAspectRatio="none"
                            className="absolute inset-0 h-full w-full touch-none select-none"
                            style={{
                                cursor:
                                    tool === 'select'
                                        ? 'default'
                                        : tool === 'entrance'
                                          ? 'copy'
                                          : 'crosshair',
                            }}
                            onPointerDown={onCanvasDown}
                            onPointerMove={onCanvasMove}
                            onPointerUp={onCanvasUp}
                            onPointerCancel={onCanvasUp}
                        >
                            {!imageUrl && (
                                <>
                                    <defs>
                                        <pattern
                                            id="floor-plan-grid"
                                            width={5}
                                            height={5}
                                            patternUnits="userSpaceOnUse"
                                        >
                                            <path
                                                d="M 5 0 L 0 0 0 5"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeOpacity={0.12}
                                                strokeWidth={1}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        </pattern>
                                    </defs>
                                    <rect
                                        width={width}
                                        height={depth}
                                        fill="url(#floor-plan-grid)"
                                        className="text-foreground"
                                    />
                                </>
                            )}

                            {shapes.halls.map((h, i) => {
                                const selected =
                                    selection?.layer === 'hall' &&
                                    selection.index === i;

                                return (
                                    <rect
                                        key={`h${i}`}
                                        x={h.x}
                                        y={h.y}
                                        width={h.w}
                                        height={h.d}
                                        fill="rgb(59 130 246 / 0.28)"
                                        stroke={
                                            selected ? '#1d4ed8' : '#3b82f6'
                                        }
                                        strokeWidth={selected ? 2.5 : 1}
                                        strokeDasharray={
                                            selected ? undefined : '4 3'
                                        }
                                        vectorEffect="non-scaling-stroke"
                                        style={{
                                            pointerEvents:
                                                tool === 'select'
                                                    ? 'auto'
                                                    : 'none',
                                            cursor: 'move',
                                        }}
                                        onPointerDown={(e) =>
                                            startMove(e, 'hall', i)
                                        }
                                    />
                                );
                            })}

                            {shapes.rooms.map((r, i) => {
                                const selected =
                                    selection?.layer === 'room' &&
                                    selection.index === i;
                                const stuck = unreachable.some(
                                    (u) => u.key === r.key,
                                );
                                const [a, b] = doorSegment(r);
                                const fontSize = 11 * unit;

                                return (
                                    <g
                                        key={`r${i}`}
                                        style={{
                                            pointerEvents:
                                                tool === 'select'
                                                    ? 'auto'
                                                    : 'none',
                                            cursor: 'move',
                                        }}
                                        onPointerDown={(e) =>
                                            startMove(e, 'room', i)
                                        }
                                    >
                                        <rect
                                            x={r.x}
                                            y={r.y}
                                            width={r.w}
                                            height={r.d}
                                            fill={ROOM_FILL[r.kind]}
                                            fillOpacity={0.6}
                                            stroke={
                                                selected
                                                    ? '#1d4ed8'
                                                    : stuck
                                                      ? '#dc2626'
                                                      : '#92400e'
                                            }
                                            strokeWidth={selected ? 2.5 : 1.2}
                                            strokeDasharray={
                                                stuck && !selected
                                                    ? '5 3'
                                                    : undefined
                                            }
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        <line
                                            x1={a.x}
                                            y1={a.y}
                                            x2={b.x}
                                            y2={b.y}
                                            stroke="#16a34a"
                                            strokeWidth={5}
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        <text
                                            x={r.x + r.w / 2}
                                            y={r.y + r.d / 2}
                                            fontSize={fontSize}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill="#1c1917"
                                            stroke="#ffffff"
                                            strokeWidth={3 * unit}
                                            paintOrder="stroke"
                                            fontWeight={600}
                                            pointerEvents="none"
                                        >
                                            {label(r.name, r.w)}
                                        </text>
                                    </g>
                                );
                            })}

                            {shapes.entrances.map((x, i) => {
                                const selected =
                                    selection?.layer === 'entrance' &&
                                    selection.index === i;
                                const arrow = 14 * unit;
                                const dir = {
                                    north: { x: 0, y: -1 },
                                    south: { x: 0, y: 1 },
                                    east: { x: 1, y: 0 },
                                    west: { x: -1, y: 0 },
                                }[x.inward];

                                return (
                                    <g
                                        key={`e${i}`}
                                        style={{
                                            pointerEvents:
                                                tool === 'select'
                                                    ? 'auto'
                                                    : 'none',
                                            cursor: 'move',
                                        }}
                                        onPointerDown={(e) =>
                                            startMove(e, 'entrance', i)
                                        }
                                    >
                                        <line
                                            x1={x.at.x}
                                            y1={x.at.y}
                                            x2={x.at.x + dir.x * arrow}
                                            y2={x.at.y + dir.y * arrow}
                                            stroke="#2563eb"
                                            strokeWidth={3}
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        <circle
                                            cx={x.at.x}
                                            cy={x.at.y}
                                            r={(selected ? 8 : 6) * unit}
                                            fill="#2563eb"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </g>
                                );
                            })}

                            {routePreview && (
                                <polyline
                                    points={routePreview
                                        .map((p) => `${p.x},${p.y}`)
                                        .join(' ')}
                                    fill="none"
                                    stroke="#1d4ed8"
                                    strokeWidth={3}
                                    strokeDasharray="6 4"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                    pointerEvents="none"
                                />
                            )}

                            {draft && (
                                <rect
                                    x={draft.x}
                                    y={draft.y}
                                    width={draft.w}
                                    height={draft.d}
                                    fill={
                                        drag?.mode === 'draw' &&
                                        drag.layer === 'hall'
                                            ? 'rgb(59 130 246 / 0.25)'
                                            : 'rgb(245 215 122 / 0.5)'
                                    }
                                    stroke="#1d4ed8"
                                    strokeWidth={1.5}
                                    vectorEffect="non-scaling-stroke"
                                    pointerEvents="none"
                                />
                            )}

                            {selectedRect &&
                                tool === 'select' &&
                                selection &&
                                selection.layer !== 'entrance' &&
                                (
                                    [
                                        ['nw', selectedRect.x, selectedRect.y],
                                        [
                                            'ne',
                                            selectedRect.x + selectedRect.w,
                                            selectedRect.y,
                                        ],
                                        [
                                            'sw',
                                            selectedRect.x,
                                            selectedRect.y + selectedRect.d,
                                        ],
                                        [
                                            'se',
                                            selectedRect.x + selectedRect.w,
                                            selectedRect.y + selectedRect.d,
                                        ],
                                    ] as const
                                ).map(([corner, cx, cy]) => (
                                    <circle
                                        key={corner}
                                        cx={cx}
                                        cy={cy}
                                        r={6 * unit}
                                        fill="#ffffff"
                                        stroke="#1d4ed8"
                                        strokeWidth={2}
                                        vectorEffect="non-scaling-stroke"
                                        style={{
                                            cursor:
                                                corner === 'nw' ||
                                                corner === 'se'
                                                    ? 'nwse-resize'
                                                    : 'nesw-resize',
                                        }}
                                        onPointerDown={(e) =>
                                            startResize(
                                                e,
                                                selection.layer as
                                                    'room' | 'hall',
                                                selection.index,
                                                corner,
                                            )
                                        }
                                    />
                                ))}
                        </svg>
                        <span className="pointer-events-none absolute top-2 left-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase shadow-sm">
                            ↑ North
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-3 rounded-sm border border-amber-800 bg-[#f5d77a]" />
                            Room
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block h-1 w-3 rounded bg-green-600" />
                            Door
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-3 rounded-sm border border-dashed border-blue-500 bg-blue-500/30" />
                            Hallway
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-3 rounded-full bg-blue-600" />
                            Entrance (line points inside)
                        </span>
                        <span>
                            Arrow keys nudge the selected shape (Shift for
                            bigger steps).
                        </span>
                    </div>

                    {/* Where it sits on the campus map */}
                    <Panel
                        title="Where the building sits on the campus map"
                        aside={
                            <Button
                                size="sm"
                                variant={placing ? 'secondary' : 'outline'}
                                onClick={() =>
                                    setPlacing(placing ? null : { first: null })
                                }
                            >
                                {placing ? (
                                    <>
                                        <X /> Cancel
                                    </>
                                ) : (
                                    <>
                                        <MapPin /> Place on map
                                    </>
                                )}
                            </Button>
                        }
                    >
                        <p className="text-xs text-muted-foreground">
                            {placing
                                ? placing.first
                                    ? 'Now click the building’s bottom-right (south-east) corner.'
                                    : 'Click the building’s top-left (north-west) corner on the map.'
                                : 'The blue outline is where the plan’s edges land on the map. The kiosk’s outdoor route ends at the entrance nearest the visitor, so line it up with the building.'}
                        </p>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                            <CampusMap
                                points={location ? [location] : []}
                                onMapClick={(p) => {
                                    if (!placing) {
                                        return;
                                    }

                                    if (!placing.first) {
                                        setPlacing({ first: p });

                                        return;
                                    }

                                    const a = placing.first;

                                    if (
                                        Math.abs(p.x - a.x) < 0.2 ||
                                        Math.abs(p.y - a.y) < 0.2
                                    ) {
                                        return;
                                    }

                                    setSite({
                                        x0: round(Math.min(a.x, p.x)),
                                        y0: round(Math.min(a.y, p.y)),
                                        x1: round(Math.max(a.x, p.x)),
                                        y1: round(Math.max(a.y, p.y)),
                                    });
                                    setSiteTouched(true);
                                    setPlacing(null);
                                    touch();
                                }}
                                previewPoint={placing?.first ?? null}
                                route={[
                                    { x: site.x0, y: site.y0 },
                                    { x: site.x1, y: site.y0 },
                                    { x: site.x1, y: site.y1 },
                                    { x: site.x0, y: site.y1 },
                                    { x: site.x0, y: site.y0 },
                                ]}
                            />
                            <div className="grid grid-cols-2 content-start gap-2">
                                {(
                                    [
                                        ['x0', 'West edge'],
                                        ['x1', 'East edge'],
                                        ['y0', 'North edge'],
                                        ['y1', 'South edge'],
                                    ] as const
                                ).map(([key, text]) => (
                                    <NumberField
                                        key={key}
                                        label={text}
                                        suffix="%"
                                        value={site[key]}
                                        onChange={(v) => {
                                            setSite({ ...site, [key]: v });
                                            setSiteTouched(true);
                                            touch();
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </Panel>
                </div>

                <aside className="space-y-4">
                    <Panel title="Building and picture">
                        <div className="grid gap-2">
                            <Label htmlFor="floor_plan_building">
                                Building
                            </Label>
                            <Select
                                value={locationId}
                                onValueChange={changeBuilding}
                            >
                                <SelectTrigger
                                    id="floor_plan_building"
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Pick a building" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((l) => (
                                        <SelectItem
                                            key={l.id}
                                            value={String(l.id)}
                                        >
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {locations.length === 0 && (
                                <p className="text-xs text-destructive">
                                    Every building on the Campus Map already has
                                    a floor plan. Add the building&apos;s pin
                                    first.
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="floor_plan_floor">Floor</Label>
                            <Input
                                id="floor_plan_floor"
                                value={floor}
                                maxLength={100}
                                onChange={(e) => {
                                    setFloor(e.target.value);
                                    touch();
                                }}
                                placeholder="Ground floor"
                            />
                            <p className="text-xs text-muted-foreground">
                                The kiosk guides visitors on the floor they walk
                                in on.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Picture of the floor sign</Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';

                                    if (file) {
                                        void chooseImage(file);
                                    }
                                }}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <ImagePlus />
                                    {imageUrl ? 'Replace' : 'Upload picture'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void rotate()}
                                    disabled={rotating}
                                    title="Turn the picture and the drawing a quarter turn clockwise"
                                >
                                    <RotateCw /> Rotate
                                </Button>
                                {imageUrl && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setImageUrl(null);
                                            setImageFile(null);
                                            setRemoveImage(Boolean(plan));
                                            touch();
                                        }}
                                    >
                                        <Trash2 /> Remove
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                A straight-on photo of the emergency exit plan
                                works well. Rotate it so north is up, matching
                                the campus map. JPG, PNG or WebP, up to 10 MB.
                            </p>
                            {imageUrl && (
                                <label className="grid gap-1 text-xs text-muted-foreground">
                                    Picture opacity
                                    <input
                                        type="range"
                                        min={0.15}
                                        max={1}
                                        step={0.05}
                                        value={imageOpacity}
                                        onChange={(e) =>
                                            setImageOpacity(
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </label>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {!imageUrl && (
                                <>
                                    <NumberField
                                        label="Grid width"
                                        suffix="units"
                                        step={1}
                                        value={width}
                                        onChange={(v) => {
                                            if (v > 0) {
                                                setWidth(v);
                                                touch();
                                            }
                                        }}
                                    />
                                    <NumberField
                                        label="Grid depth"
                                        suffix="units"
                                        step={1}
                                        value={depth}
                                        onChange={(v) => {
                                            if (v > 0) {
                                                setDepth(v);
                                                touch();
                                            }
                                        }}
                                    />
                                </>
                            )}
                            <div className="col-span-2">
                                <NumberField
                                    label="Real width of the building"
                                    suffix="m"
                                    step={1}
                                    value={realWidth}
                                    onChange={(v) => {
                                        if (v > 0) {
                                            setMetersPerUnit(v / width);
                                            touch();
                                        }
                                    }}
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    West wall to east wall, for the walking
                                    distances read out to visitors (about{' '}
                                    {round(depth * metersPerUnit)} m deep).
                                </p>
                            </div>
                        </div>
                    </Panel>

                    {selection && (
                        <Panel
                            title={
                                selection.layer === 'room'
                                    ? 'Room'
                                    : selection.layer === 'hall'
                                      ? 'Hallway'
                                      : 'Entrance'
                            }
                            aside={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={removeSelected}
                                >
                                    <Trash2 /> Delete
                                </Button>
                            }
                        >
                            {selection.layer === 'room' &&
                                shapes.rooms[selection.index] &&
                                (() => {
                                    const i = selection.index;
                                    const r = shapes.rooms[i];
                                    const inIt = officesByRoom.get(r.key);

                                    return (
                                        <>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="room_name">
                                                    Name on the sign
                                                </Label>
                                                <Input
                                                    id="room_name"
                                                    value={r.name}
                                                    maxLength={100}
                                                    onChange={(e) =>
                                                        renameRoom(
                                                            i,
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {inIt
                                                        ? `In the Directory as: ${inIt.join(', ')}.`
                                                        : 'Place an office here from the School Directory.'}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="room_kind">
                                                        Kind
                                                    </Label>
                                                    <Select
                                                        value={r.kind}
                                                        onValueChange={(v) =>
                                                            updateRoom(i, {
                                                                kind: v as RoomKind,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="room_kind"
                                                            className="w-full"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {ROOM_KINDS.map(
                                                                (k) => (
                                                                    <SelectItem
                                                                        key={
                                                                            k.value
                                                                        }
                                                                        value={
                                                                            k.value
                                                                        }
                                                                    >
                                                                        {
                                                                            k.label
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="room_door">
                                                        Door side
                                                    </Label>
                                                    <Select
                                                        value={r.door}
                                                        onValueChange={(v) =>
                                                            updateRoom(i, {
                                                                door: v as Side,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="room_door"
                                                            className="w-full"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {SIDES.map((s) => (
                                                                <SelectItem
                                                                    key={s}
                                                                    value={s}
                                                                >
                                                                    {
                                                                        SIDE_LABEL[
                                                                            s
                                                                        ]
                                                                    }
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(
                                                    [
                                                        ['x', 'Left'],
                                                        ['y', 'Top'],
                                                        ['w', 'Width'],
                                                        ['d', 'Depth'],
                                                    ] as const
                                                ).map(([k, text]) => (
                                                    <NumberField
                                                        key={k}
                                                        label={text}
                                                        value={r[k]}
                                                        onChange={(v) =>
                                                            updateRoom(i, {
                                                                [k]:
                                                                    k === 'w' ||
                                                                    k === 'd'
                                                                        ? Math.max(
                                                                              MIN_SIZE,
                                                                              v,
                                                                          )
                                                                        : Math.max(
                                                                              0,
                                                                              v,
                                                                          ),
                                                            })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                            <p
                                                className={cn(
                                                    'flex items-start gap-1.5 text-xs',
                                                    unreachable.some(
                                                        (u) => u.key === r.key,
                                                    )
                                                        ? 'text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {unreachable.some(
                                                    (u) => u.key === r.key,
                                                ) ? (
                                                    <>
                                                        <CircleAlert className="mt-px size-3.5 shrink-0" />
                                                        No hallway reaches this
                                                        door. Move the door or
                                                        stretch a hallway to
                                                        touch it.
                                                    </>
                                                ) : routePreview ? (
                                                    'The dashed blue line is the walk the kiosk will show.'
                                                ) : shapes.entrances.length ===
                                                  0 ? (
                                                    'Add an entrance to preview the walk here.'
                                                ) : null}
                                            </p>
                                        </>
                                    );
                                })()}

                            {selection.layer === 'hall' &&
                                shapes.halls[selection.index] && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {(
                                            [
                                                ['x', 'Left'],
                                                ['y', 'Top'],
                                                ['w', 'Width'],
                                                ['d', 'Depth'],
                                            ] as const
                                        ).map(([k, text]) => (
                                            <NumberField
                                                key={k}
                                                label={text}
                                                value={
                                                    shapes.halls[
                                                        selection.index
                                                    ][k]
                                                }
                                                onChange={(v) =>
                                                    updateHall(
                                                        selection.index,
                                                        {
                                                            [k]:
                                                                k === 'w' ||
                                                                k === 'd'
                                                                    ? Math.max(
                                                                          MIN_SIZE,
                                                                          v,
                                                                      )
                                                                    : Math.max(
                                                                          0,
                                                                          v,
                                                                      ),
                                                        },
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                )}

                            {selection.layer === 'entrance' &&
                                shapes.entrances[selection.index] &&
                                (() => {
                                    const i = selection.index;
                                    const x = shapes.entrances[i];

                                    return (
                                        <>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="entrance_name">
                                                    Name
                                                </Label>
                                                <Input
                                                    id="entrance_name"
                                                    value={x.name}
                                                    maxLength={150}
                                                    onChange={(e) =>
                                                        updateEntrance(i, {
                                                            name: e.target
                                                                .value,
                                                        })
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    The kiosk says: &ldquo;Go in
                                                    through {x.name}
                                                    .&rdquo;
                                                </p>
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="entrance_inward">
                                                    Facing when walking in
                                                </Label>
                                                <Select
                                                    value={x.inward}
                                                    onValueChange={(v) =>
                                                        updateEntrance(i, {
                                                            inward: v as Side,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="entrance_inward"
                                                        className="w-full"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SIDES.map((s) => (
                                                            <SelectItem
                                                                key={s}
                                                                value={s}
                                                            >
                                                                {SIDE_LABEL[s]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <NumberField
                                                    label="Left"
                                                    value={x.at.x}
                                                    onChange={(v) =>
                                                        updateEntrance(i, {
                                                            at: {
                                                                ...x.at,
                                                                x: clamp(
                                                                    v,
                                                                    0,
                                                                    width,
                                                                ),
                                                            },
                                                        })
                                                    }
                                                />
                                                <NumberField
                                                    label="Top"
                                                    value={x.at.y}
                                                    onChange={(v) =>
                                                        updateEntrance(i, {
                                                            at: {
                                                                ...x.at,
                                                                y: clamp(
                                                                    v,
                                                                    0,
                                                                    depth,
                                                                ),
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                        </>
                                    );
                                })()}
                        </Panel>
                    )}

                    <Panel title="Checks">
                        <ul className="space-y-2 text-sm">
                            <Check
                                ok={shapes.entrances.length > 0}
                                text={
                                    shapes.entrances.length > 0
                                        ? `${shapes.entrances.length} entrance${shapes.entrances.length === 1 ? '' : 's'}`
                                        : 'Add at least one entrance'
                                }
                            />
                            <Check
                                ok={shapes.halls.length > 0}
                                text={
                                    shapes.halls.length > 0
                                        ? `${shapes.halls.length} hallway${shapes.halls.length === 1 ? '' : 's'}`
                                        : 'Draw the hallways'
                                }
                            />
                            {strandedEntrances.length > 0 && (
                                <Check
                                    ok={false}
                                    text={`Not on a hallway: ${strandedEntrances.map((x) => x.name).join(', ')}`}
                                />
                            )}
                            <Check
                                ok={
                                    destinations.length > 0 &&
                                    unreachable.length === 0 &&
                                    shapes.entrances.length > 0
                                }
                                text={
                                    destinations.length === 0
                                        ? 'Draw the rooms'
                                        : unreachable.length > 0
                                          ? `Can't be reached: ${unreachable.map((r) => r.name).join(', ')}`
                                          : shapes.entrances.length > 0
                                            ? `All ${destinations.length} rooms can be reached`
                                            : `${destinations.length} rooms drawn`
                                }
                            />
                        </ul>
                    </Panel>

                    <Panel title={`Rooms (${shapes.rooms.length})`}>
                        {shapes.rooms.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                None yet. Pick the Room tool and drag over a
                                room on the picture.
                            </p>
                        ) : (
                            <ul className="-mx-2 max-h-72 overflow-y-auto">
                                {shapes.rooms.map((r, i) => {
                                    const stuck = unreachable.some(
                                        (u) => u.key === r.key,
                                    );
                                    const inIt = officesByRoom.get(r.key);

                                    return (
                                        <li key={`${r.key}-${i}`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTool('select');
                                                    setSelection({
                                                        layer: 'room',
                                                        index: i,
                                                    });
                                                }}
                                                className={cn(
                                                    'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                                                    selection?.layer ===
                                                        'room' &&
                                                        selection.index === i &&
                                                        'bg-muted',
                                                )}
                                            >
                                                <span
                                                    className="mt-1 inline-block size-2.5 shrink-0 rounded-sm border border-amber-800"
                                                    style={{
                                                        background:
                                                            ROOM_FILL[r.kind],
                                                    }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium">
                                                        {r.name}
                                                    </span>
                                                    {inIt && (
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            {inIt.join(', ')}
                                                        </span>
                                                    )}
                                                </span>
                                                {stuck && (
                                                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </aside>
            </div>
        </div>
    );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
    return (
        <li
            className={cn(
                'flex items-start gap-2',
                ok ? 'text-foreground' : 'text-destructive',
            )}
        >
            {ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
            ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            {text}
        </li>
    );
}
