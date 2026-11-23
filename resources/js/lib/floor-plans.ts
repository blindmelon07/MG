/**
 * Indoor floor plans, for walking someone from a building's entrance to a
 * room's door once the campus route has brought them to the building.
 *
 * Plans are laid out in "plan units" taken straight off the school's posted
 * floor signs (x to the right/east, y down/south). Each plan also says where
 * it sits on the campus map (map percent), so the outdoor route can end at
 * the right entrance.
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
    /** Matches the campus location this plan belongs to, by name. */
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
};

/*
 * Main Building, ground floor — from the "Ground Floor · Floor Emergency Exit
 * Plan" sign. The plan covers the wings around the ACI Quadrangle: the
 * high school wing (north), the office block (west) and the college wing
 * (south). One plan unit is 10 px on the photographed sign.
 */
const MAIN_BUILDING_GROUND: FloorPlan = {
    building: 'Main Building',
    floor: 'Ground floor',
    width: 58.4,
    depth: 36,
    metersPerUnit: 1.15,
    site: { x0: 62.5, y0: 39.45, x1: 97.7, y1: 72.97 },
    rooms: [
        // High school wing, north side of the north hallway
        {
            key: 'avr',
            name: 'Audio Visual Room (AVR)',
            kind: 'office',
            x: 0,
            y: 0,
            w: 6,
            d: 6.6,
            door: 'south',
        },
        {
            key: 'stairs-north',
            name: 'Stairs',
            kind: 'stairs',
            x: 11,
            y: 0,
            w: 4.7,
            d: 6.6,
            door: 'south',
        },
        {
            key: 'quality-assurance',
            name: 'Quality Assurance Office',
            kind: 'office',
            x: 15.7,
            y: 0,
            w: 10.7,
            d: 6.6,
            door: 'south',
        },
        {
            key: 'st-joseph',
            name: 'St. Joseph',
            kind: 'classroom',
            x: 26.4,
            y: 0,
            w: 10.6,
            d: 6.6,
            door: 'south',
        },
        {
            key: 'st-dominic',
            name: 'St. Dominic',
            kind: 'classroom',
            x: 37,
            y: 0,
            w: 10.6,
            d: 6.6,
            door: 'south',
        },
        {
            key: 'hs-faculty',
            name: 'High School Faculty Room',
            kind: 'office',
            x: 47.6,
            y: 0,
            w: 10.8,
            d: 6.6,
            door: 'south',
        },
        // Office block, west of the quadrangle
        {
            key: 'clinic',
            name: 'School Clinic',
            kind: 'office',
            x: 0,
            y: 11.2,
            w: 5.7,
            d: 3.2,
            door: 'east',
        },
        {
            key: 'cashier',
            name: 'Cashier',
            kind: 'office',
            x: 0,
            y: 14.4,
            w: 5.7,
            d: 3.2,
            door: 'east',
        },
        {
            key: 'registrar',
            name: 'Registrar',
            kind: 'office',
            x: 0,
            y: 17.6,
            w: 5.7,
            d: 3.2,
            door: 'east',
        },
        {
            key: 'principal',
            name: "Principal's Offices",
            kind: 'office',
            x: 0,
            y: 20.8,
            w: 5.7,
            d: 3.2,
            door: 'east',
        },
        {
            key: 'quadrangle',
            name: 'ACI Quadrangle',
            kind: 'open',
            x: 10.8,
            y: 11.4,
            w: 47.6,
            d: 12.2,
            door: 'south',
        },
        // College wing, south side of the south hallway
        {
            key: 'stairs-southwest',
            name: 'Stairs',
            kind: 'stairs',
            x: 0,
            y: 28.7,
            w: 4.7,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'room-4',
            name: 'Room 4',
            kind: 'classroom',
            x: 10,
            y: 28.7,
            w: 6.5,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'room-3',
            name: 'Room 3',
            kind: 'classroom',
            x: 16.8,
            y: 28.7,
            w: 6.6,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'st-luke',
            name: 'St. Luke',
            kind: 'classroom',
            x: 32,
            y: 28.7,
            w: 6.4,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'st-mark',
            name: 'St. Mark',
            kind: 'classroom',
            x: 38.8,
            y: 28.7,
            w: 6.4,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'stairs-southeast',
            name: 'Stairs',
            kind: 'stairs',
            x: 45.6,
            y: 28.7,
            w: 4.6,
            d: 7.1,
            door: 'north',
        },
        {
            key: 'science-lab',
            name: 'Science Laboratory',
            kind: 'lab',
            x: 50.6,
            y: 28.7,
            w: 7.8,
            d: 7.1,
            door: 'north',
        },
    ],
    halls: [
        { x: 0, y: 6.8, w: 58.4, d: 4.2 }, // north hallway
        { x: 5.8, y: 11, w: 4.8, d: 13 }, // corridor beside the offices
        { x: 0, y: 24, w: 58.4, d: 4.4 }, // south hallway
        { x: 6, y: 0, w: 5, d: 6.8 }, // passage north, beside the AVR
        { x: 4.9, y: 28.4, w: 4.8, d: 7.6 }, // passage south, beside Room 4
        { x: 23.8, y: 28.4, w: 7.8, d: 7.6 }, // gateway to the soccer field
    ],
    entrances: [
        {
            key: 'gateway',
            name: 'the main entrance (Gateway to the Soccer Field)',
            at: { x: 27.7, y: 35.9 },
            inward: 'north',
        },
        {
            key: 'southwest',
            name: 'the south-west entrance beside Room 4',
            at: { x: 7.3, y: 35.9 },
            inward: 'north',
        },
        {
            key: 'north',
            name: 'the north entrance beside the AVR',
            at: { x: 8.5, y: 0.1 },
            inward: 'south',
        },
    ],
};

export const FLOOR_PLANS: FloorPlan[] = [MAIN_BUILDING_GROUND];

export function floorPlanFor(buildingName: string | null | undefined) {
    if (!buildingName) {
        return null;
    }

    const name = buildingName.trim().toLowerCase();

    return FLOOR_PLANS.find((p) => p.building.toLowerCase() === name) ?? null;
}

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
 * (breadth-first search on a fine grid, then straightened).
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
    const index = (c: number, r: number) => r * cols + c;
    const previous = new Int32Array(cols * rows).fill(-2);
    const queue = [index(start.c, start.r)];
    previous[queue[0]] = -1;

    for (let head = 0; head < queue.length; head++) {
        const current = queue[head];

        if (current === index(goal.c, goal.r)) {
            break;
        }

        const c = current % cols;
        const r = Math.floor(current / cols);

        for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const nc = c + dc;
            const nr = r + dr;

            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
                continue;
            }

            const next = index(nc, nr);

            if (previous[next] !== -2 || !walkable(nc, nr)) {
                continue;
            }

            previous[next] = current;
            queue.push(next);
        }
    }

    if (previous[index(goal.c, goal.r)] === -2) {
        return null;
    }

    const cells: MapPoint[] = [];

    for (let i = index(goal.c, goal.r); i !== -1; i = previous[i]) {
        cells.push({ x: (i % cols) * CELL, y: Math.floor(i / cols) * CELL });
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
                ? `Continue about ${spokenDistance(last)}. ${room.name} is ${where}.`
                : `${room.name} is ${where}.`,
        turn: null,
    });

    return { plan, room, entrance, points, guide, steps };
}
