/**
 * Indoor floor plans, for walking someone from a building's entrance to a
 * room's door once the campus route has brought them to the building.
 *
 * Plans are drawn by admins (Admin → Floor Plans) over a picture of the
 * building's floor sign, in "plan units" (x to the right/east, y down/south),
 * and stored in the floor_plans table. Each plan also says where it sits on
 * the campus map (map percent), so the outdoor route can end at the right
 * entrance.
 *
 * Pure: no React, no Three.js.
 */
import { buildGuide, spokenDistance } from '@/lib/campus-route';
import type { MapPoint, RouteGuide } from '@/lib/campus-route';

export type Rect = { x: number; y: number; w: number; d: number };

export type RoomKind =
    'office' | 'classroom' | 'lab' | 'stairs' | 'open' | 'outside';

export type Room = Rect & {
    key: string;
    name: string;
    kind: RoomKind;
    /** The side of the room its door opens onto. */
    door: 'north' | 'south' | 'east' | 'west';
};

export type Entrance = {
    key: string;
    name: string;
    /** Where you stand when you walk in (plan units, on the building's edge). */
    at: MapPoint;
    /** The way you face when walking in. */
    inward: 'north' | 'south' | 'east' | 'west';
};

export type FloorPlan = {
    /** The campus location (building pin) this plan belongs to. */
    campusLocationId: number;
    building: string;
    floor: string;
    width: number;
    depth: number;
    /** Roughly how many metres one plan unit is. */
    metersPerUnit: number;
    /** Where the plan's corners sit on the campus map (map percent). */
    site: { x0: number; y0: number; x1: number; y1: number };
    rooms: Room[];
    /** Hallways and other walkable floor. */
    halls: Rect[];
    entrances: Entrance[];
    /** The picture the plan was traced over, if one was uploaded. */
    imageUrl?: string | null;
};

export const ROOM_KINDS: { value: RoomKind; label: string }[] = [
    { value: 'office', label: 'Office' },
    { value: 'classroom', label: 'Classroom' },
    { value: 'lab', label: 'Laboratory' },
    { value: 'stairs', label: 'Stairs' },
    { value: 'open', label: 'Open area (courtyard, lobby)' },
    { value: 'outside', label: 'Outside' },
];

export const SIDES = ['north', 'south', 'east', 'west'] as const;
export type Side = (typeof SIDES)[number];

export function roomByKey(plan: FloorPlan, key: string | null | undefined) {
    return plan.rooms.find((r) => r.key === key) ?? null;
}

/** Rooms people would be sent to (not stairs or the open quadrangle). */
export function destinationRooms(plan: FloorPlan) {
    return plan.rooms.filter((r) => r.kind !== 'stairs' && r.kind !== 'open');
}

/** A plan point on the campus map (map percent). */
export function planToSite(plan: FloorPlan, p: MapPoint): MapPoint {
    return {
        x: plan.site.x0 + (p.x / plan.width) * (plan.site.x1 - plan.site.x0),
        y: plan.site.y0 + (p.y / plan.depth) * (plan.site.y1 - plan.site.y0),
    };
}

/** The entrance nearest to where someone is coming from on the campus map. */
export function nearestEntrance(plan: FloorPlan, from: MapPoint) {
    let best = plan.entrances[0];
    let bestDistance = Infinity;

    for (const entrance of plan.entrances) {
        const site = planToSite(plan, entrance.at);
        const distance = Math.hypot(site.x - from.x, site.y - from.y);

        if (distance < bestDistance) {
            best = entrance;
            bestDistance = distance;
        }
    }

    return best;
}

/** Just outside an entrance on the campus map, where the outdoor walk ends. */
export function entranceApproach(plan: FloorPlan, entrance: Entrance) {
    const step = 1.5; // plan units outside the wall
    const out = {
        north: { x: 0, y: step },
        south: { x: 0, y: -step },
        east: { x: -step, y: 0 },
        west: { x: step, y: 0 },
    }[entrance.inward];

    return planToSite(plan, {
        x: entrance.at.x + out.x,
        y: entrance.at.y + out.y,
    });
}

/** Middle of the doorway, on the hallway side. */
export function doorPoint(room: Room): MapPoint {
    switch (room.door) {
        case 'north':
            return { x: room.x + room.w / 2, y: room.y };
        case 'south':
            return { x: room.x + room.w / 2, y: room.y + room.d };
        case 'east':
            return { x: room.x + room.w, y: room.y + room.d / 2 };
        case 'west':
            return { x: room.x, y: room.y + room.d / 2 };
    }
}

// Grid cell for indoor routing, in plan units (about half a metre).
const CELL = 0.5;

function inRect(x: number, y: number, r: Rect) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
}

/**
 * Shortest walk through the hallways from an entrance to a room's door
 * (a search on a fine grid that keeps to the middle of hallways and avoids
 * needless turns, then straightened).
 */
export function indoorRoute(
    plan: FloorPlan,
    entrance: Entrance,
    room: Room,
): MapPoint[] | null {
    const cols = Math.ceil(plan.width / CELL) + 1;
    const rows = Math.ceil(plan.depth / CELL) + 1;
    const door = doorPoint(room);
    const walkable = (c: number, r: number) => {
        const x = c * CELL;
        const y = r * CELL;

        return (
            plan.halls.some((h) => inRect(x, y, h)) ||
            Math.hypot(x - door.x, y - door.y) <= CELL * 1.5
        );
    };
    const toCell = (p: MapPoint) => ({
        c: Math.min(cols - 1, Math.max(0, Math.round(p.x / CELL))),
        r: Math.min(rows - 1, Math.max(0, Math.round(p.y / CELL))),
    });

    const start = toCell(entrance.at);
    const goal = toCell(door);
    const goalIndex = goal.r * cols + goal.c;
    const cellCount = cols * rows;

    // Extra cost near walls, so the walk keeps to the middle of a hallway
    // the way people do (and the way the steps should describe it).
    const stepCost = new Float32Array(cellCount).fill(-1);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!walkable(c, r)) {
                continue;
            }

            const x = c * CELL;
            const y = r * CELL;
            let depth = 0;

            for (const h of plan.halls) {
                if (inRect(x, y, h)) {
                    depth = Math.max(
                        depth,
                        Math.min(
                            x - h.x,
                            h.x + h.w - x,
                            y - h.y,
                            h.y + h.d - y,
                        ),
                    );
                }
            }

            stepCost[r * cols + c] = 1 + (depth < 1 ? 2 : depth < 2 ? 0.6 : 0);
        }
    }

    // Dijkstra over (cell, heading): turning costs extra, so of the equally
    // short walks it picks the one with the fewest, cleanest turns.
    const TURN_COST = 8;
    const DIRS = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];
    const best = new Float64Array(cellCount * 4).fill(Infinity);
    const previous = new Int32Array(cellCount * 4).fill(-1);
    const heap: [number, number][] = [];
    const push = (cost: number, state: number) => {
        heap.push([cost, state]);
        let i = heap.length - 1;

        while (i > 0) {
            const parent = (i - 1) >> 1;

            if (heap[parent][0] <= heap[i][0]) {
                break;
            }

            [heap[parent], heap[i]] = [heap[i], heap[parent]];
            i = parent;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop()!;

        if (heap.length > 0) {
            heap[0] = last;
            let i = 0;

            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;

                if (l < heap.length && heap[l][0] < heap[m][0]) {
                    m = l;
                }

                if (r < heap.length && heap[r][0] < heap[m][0]) {
                    m = r;
                }

                if (m === i) {
                    break;
                }

                [heap[m], heap[i]] = [heap[i], heap[m]];
                i = m;
            }
        }

        return top;
    };

    const startIndex = start.r * cols + start.c;

    for (let d = 0; d < 4; d++) {
        best[startIndex * 4 + d] = 0;
        push(0, startIndex * 4 + d);
    }

    let reached = -1;

    while (heap.length > 0) {
        const [cost, state] = pop();

        if (cost > best[state]) {
            continue;
        }

        const cell = state >> 2;
        const heading = state & 3;

        if (cell === goalIndex) {
            reached = state;
            break;
        }

        const c = cell % cols;
        const r = Math.floor(cell / cols);

        for (let d = 0; d < 4; d++) {
            const nc = c + DIRS[d][0];
            const nr = r + DIRS[d][1];

            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
                continue;
            }

            const next = nr * cols + nc;

            if (stepCost[next] < 0) {
                continue;
            }

            const nextCost =
                cost + stepCost[next] + (d === heading ? 0 : TURN_COST);
            const nextState = next * 4 + d;

            if (nextCost < best[nextState]) {
                best[nextState] = nextCost;
                previous[nextState] = state;
                push(nextCost, nextState);
            }
        }
    }

    if (reached < 0) {
        return null;
    }

    const cells: MapPoint[] = [];

    for (let state = reached; state !== -1; state = previous[state]) {
        const cell = state >> 2;
        cells.push({
            x: (cell % cols) * CELL,
            y: Math.floor(cell / cols) * CELL,
        });

        if (cell === startIndex && previous[state] === -1) {
            break;
        }
    }

    cells.reverse();

    // Keep only the corners.
    const points: MapPoint[] = [cells[0]];

    for (let i = 1; i < cells.length - 1; i++) {
        const a = points[points.length - 1];
        const b = cells[i];
        const c = cells[i + 1];
        const straight =
            (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);

        if (!straight) {
            points.push(b);
        }
    }

    points.push(cells[cells.length - 1]);

    return points;
}

export type IndoorWalk = {
    plan: FloorPlan;
    room: Room;
    entrance: Entrance;
    points: MapPoint[];
    guide: RouteGuide;
    steps: { text: string; turn: number | null }[];
};

/** Which hand the door is on at the end of the walk. */
function doorSide(guide: RouteGuide, room: Room): 'left' | 'right' | 'ahead' {
    const n = guide.meters.length;

    if (n < 2) {
        return 'ahead';
    }

    const a = guide.meters[n - 2];
    const b = guide.meters[n - 1];
    const dir = { east: b.east - a.east, north: b.north - a.north };
    const center = { x: room.x + room.w / 2, y: room.y + room.d / 2 };
    // Plan y points south, so north is -y.
    const toRoom = {
        east: center.x - guide.points[n - 1].x,
        north: -(center.y - guide.points[n - 1].y),
    };
    const cross = dir.east * toRoom.north - dir.north * toRoom.east;
    const dot = dir.east * toRoom.east + dir.north * toRoom.north;

    if (Math.abs(cross) < Math.abs(dot) * 0.3) {
        return 'ahead';
    }

    return cross > 0 ? 'left' : 'right';
}

export function planIndoorWalk(
    plan: FloorPlan,
    roomKey: string,
    comingFrom: MapPoint,
    /** What to call the room in the steps, e.g. the office's own name. */
    label?: string,
): IndoorWalk | null {
    const room = roomByKey(plan, roomKey);

    if (!room) {
        return null;
    }

    const entrance = nearestEntrance(plan, comingFrom);
    const points = indoorRoute(plan, entrance, room);

    if (!points) {
        return null;
    }

    const toMeters = (p: MapPoint) => ({
        east: p.x * plan.metersPerUnit,
        north: -p.y * plan.metersPerUnit,
    });
    // The last step sideways through the doorway reads better as "on your
    // left" than as one more turn, so describe the walk without it.
    const stub =
        points.length > 2 &&
        Math.hypot(
            points[points.length - 1].x - points[points.length - 2].x,
            points[points.length - 1].y - points[points.length - 2].y,
        ) <= 5
            ? points.slice(0, -1)
            : points;
    const guide = buildGuide(stub, toMeters);
    const steps: IndoorWalk['steps'] = [
        { text: `Go in through ${entrance.name}.`, turn: null },
    ];
    let from = 0;

    for (const maneuver of guide.maneuvers) {
        const leg = maneuver.at - from;
        steps.push({
            text:
                leg >= 3
                    ? `Walk about ${spokenDistance(leg)} along the hallway, then ${maneuver.phrase}.`
                    : `${maneuver.phrase.charAt(0).toUpperCase()}${maneuver.phrase.slice(1)}.`,
            turn: maneuver.turn,
        });
        from = maneuver.at;
    }

    const side = doorSide(guide, room);
    const last = guide.length - from;
    const where = side === 'ahead' ? 'straight ahead' : `on your ${side}`;
    steps.push({
        text:
            last >= 3
                ? `Continue about ${spokenDistance(last)}. ${label ?? room.name} is ${where}.`
                : `${label ?? room.name} is ${where}.`,
        turn: null,
    });

    return { plan, room, entrance, points, guide, steps };
}

/**
 * Keys of the rooms whose door can be reached from at least one entrance
 * along the hallways — the editor's check that a drawn plan actually routes.
 * Same grid and walkable floor as indoorRoute, as a plain flood fill.
 */
export function reachableRooms(plan: FloorPlan): Set<string> {
    const cols = Math.ceil(plan.width / CELL) + 1;
    const rows = Math.ceil(plan.depth / CELL) + 1;
    const doors = plan.rooms.map((room) => ({
        key: room.key,
        at: doorPoint(room),
    }));
    const walkable = new Uint8Array(cols * rows);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * CELL;
            const y = r * CELL;

            if (
                plan.halls.some((h) => inRect(x, y, h)) ||
                doors.some(
                    (d) => Math.hypot(x - d.at.x, y - d.at.y) <= CELL * 1.5,
                )
            ) {
                walkable[r * cols + c] = 1;
            }
        }
    }

    const toIndex = (p: MapPoint) =>
        Math.min(rows - 1, Math.max(0, Math.round(p.y / CELL))) * cols +
        Math.min(cols - 1, Math.max(0, Math.round(p.x / CELL)));
    const seen = new Uint8Array(cols * rows);
    const queue: number[] = [];

    for (const entrance of plan.entrances) {
        const start = toIndex(entrance.at);

        if (!seen[start]) {
            seen[start] = 1;
            queue.push(start);
        }
    }

    for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        const c = cell % cols;
        const r = Math.floor(cell / cols);

        for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const nc = c + dc;
            const nr = r + dr;
            const next = nr * cols + nc;

            if (
                nc >= 0 &&
                nr >= 0 &&
                nc < cols &&
                nr < rows &&
                walkable[next] &&
                !seen[next]
            ) {
                seen[next] = 1;
                queue.push(next);
            }
        }
    }

    return new Set(doors.filter((d) => seen[toIndex(d.at)]).map((d) => d.key));
}
