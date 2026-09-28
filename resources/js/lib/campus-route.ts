/**
 * Walking routes across campus, and turn-by-turn guidance along them.
 *
 * Routing runs on a fine grid laid over the campus plot: solid buildings are
 * off limits, classroom blocks with open ground-floor corridors can be walked
 * through (at a cost, so routes go around them when that's reasonable),
 * paved areas and covered walks are preferred, and the public road is avoided.
 *
 * Everything here is pure: the scene's layout comes in as `WalkingAreas`, and
 * positions are map percent (0–100) or local metres, never Three.js objects.
 */

export type Box = { col: number; row: number; w: number; d: number };

export type WalkingAreas = {
    width: number;
    depth: number;
    /** Solid buildings: no way through. */
    blocked: Box[];
    /** Buildings with open ground-floor corridors: passable but slower. */
    corridors: Box[];
    /** Doorways and gates cut through blocked or corridor buildings. */
    passages: Box[];
    /** Paved areas and covered walks. */
    preferred: Box[];
    /** Public road along the frontage. */
    avoided: Box[];
};

export type MapPoint = { x: number; y: number };

// ~30 cm cells: fine enough for doorways, small enough to search instantly.
const CELL = 0.08;
// Keep paths a little off the walls.
const CLEARANCE = 0.06;
const COST = { normal: 1, preferred: 0.85, corridor: 4, avoided: 2.5 };
// How far to look for a walkable cell when a spot is inside a building.
const SNAP_RADIUS_CELLS = 60;

type Grid = {
    cols: number;
    rows: number;
    cost: Float32Array;
    areas: WalkingAreas;
};

function inBox(x: number, z: number, box: Box, areas: WalkingAreas, pad = 0) {
    const x0 = box.col - areas.width / 2 - pad;
    const z0 = box.row - areas.depth / 2 - pad;

    return (
        x >= x0 &&
        x <= x0 + box.w + 2 * pad &&
        z >= z0 &&
        z <= z0 + box.d + 2 * pad
    );
}

function buildGrid(areas: WalkingAreas): Grid {
    const cols = Math.ceil(areas.width / CELL);
    const rows = Math.ceil(areas.depth / CELL);
    const cost = new Float32Array(cols * rows);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = -areas.width / 2 + (c + 0.5) * CELL;
            const z = -areas.depth / 2 + (r + 0.5) * CELL;
            const through = areas.passages.some((b) => inBox(x, z, b, areas));
            let value = COST.normal;

            if (areas.avoided.some((b) => inBox(x, z, b, areas))) {
                value = COST.avoided;
            } else if (areas.preferred.some((b) => inBox(x, z, b, areas))) {
                value = COST.preferred;
            }

            if (
                !through &&
                areas.corridors.some((b) => inBox(x, z, b, areas, CLEARANCE))
            ) {
                value = COST.corridor;
            }

            if (
                !through &&
                areas.blocked.some((b) => inBox(x, z, b, areas, CLEARANCE))
            ) {
                value = Infinity;
            }

            cost[r * cols + c] = value;
        }
    }

    return { cols, rows, cost, areas };
}

/** Minimal binary heap keyed on f-score, for A*. */
class Heap {
    private items: number[] = [];

    constructor(private readonly score: Float64Array) {}

    get size() {
        return this.items.length;
    }

    push(item: number) {
        const items = this.items;
        items.push(item);
        let i = items.length - 1;

        while (i > 0) {
            const parent = (i - 1) >> 1;

            if (this.score[items[parent]] <= this.score[items[i]]) {
                break;
            }

            [items[parent], items[i]] = [items[i], items[parent]];
            i = parent;
        }
    }

    pop(): number {
        const items = this.items;
        const top = items[0];
        const last = items.pop() as number;

        if (items.length > 0) {
            items[0] = last;
            let i = 0;

            for (;;) {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;

                if (
                    left < items.length &&
                    this.score[items[left]] < this.score[items[smallest]]
                ) {
                    smallest = left;
                }

                if (
                    right < items.length &&
                    this.score[items[right]] < this.score[items[smallest]]
                ) {
                    smallest = right;
                }

                if (smallest === i) {
                    break;
                }

                [items[smallest], items[i]] = [items[i], items[smallest]];
                i = smallest;
            }
        }

        return top;
    }
}

const NEIGHBOURS: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
];

export function createRouter(areas: WalkingAreas) {
    const grid = buildGrid(areas);
    const { cols, rows, cost } = grid;

    const toCell = ({ x, y }: MapPoint) => {
        const wx = (x / 100) * areas.width;
        const wz = (y / 100) * areas.depth;

        return {
            c: Math.min(cols - 1, Math.max(0, Math.floor(wx / CELL))),
            r: Math.min(rows - 1, Math.max(0, Math.floor(wz / CELL))),
        };
    };

    const toPoint = (index: number): MapPoint => ({
        x: ((((index % cols) + 0.5) * CELL) / areas.width) * 100,
        y: (((Math.floor(index / cols) + 0.5) * CELL) / areas.depth) * 100,
    });

    const walkable = (c: number, r: number) =>
        c >= 0 &&
        r >= 0 &&
        c < cols &&
        r < rows &&
        Number.isFinite(cost[r * cols + c]);

    /** Nearest walkable cell, for spots inside a building or a GPS fix on a roof. */
    const snap = (point: MapPoint): number | null => {
        const { c, r } = toCell(point);

        for (let radius = 0; radius <= SNAP_RADIUS_CELLS; radius++) {
            let best: number | null = null;
            let bestDistance = Infinity;

            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (
                        Math.max(Math.abs(dr), Math.abs(dc)) !== radius ||
                        !walkable(c + dc, r + dr)
                    ) {
                        continue;
                    }

                    const distance = dc * dc + dr * dr;

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = (r + dr) * cols + (c + dc);
                    }
                }
            }

            if (best !== null) {
                return best;
            }
        }

        return null;
    };

    /** Straight line between two cells crosses no blocked cell and no slow corridor. */
    const clearLine = (a: number, b: number) => {
        const ac = a % cols;
        const ar = Math.floor(a / cols);
        const bc = b % cols;
        const br = Math.floor(b / cols);
        const steps = Math.ceil(Math.hypot(bc - ac, br - ar) * 2);
        const startCost = cost[a];

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const c = Math.round(ac + (bc - ac) * t);
            const r = Math.round(ar + (br - ar) * t);
            const value = cost[r * cols + c];

            // Don't shortcut into a corridor or onto the road unless already on it.
            if (
                !Number.isFinite(value) ||
                (value > COST.normal && value > startCost)
            ) {
                return false;
            }
        }

        return true;
    };

    /**
     * Walking route between two map spots, as a few straight legs.
     * Returns null when no route exists.
     */
    const route = (from: MapPoint, to: MapPoint): MapPoint[] | null => {
        const start = snap(from);
        const goal = snap(to);

        if (start === null || goal === null) {
            return null;
        }

        if (start === goal) {
            return [toPoint(start), toPoint(goal)];
        }

        const total = cols * rows;
        const g = new Float64Array(total).fill(Infinity);
        const f = new Float64Array(total).fill(Infinity);
        const cameFrom = new Int32Array(total).fill(-1);
        const closed = new Uint8Array(total);
        const gc = goal % cols;
        const gr = Math.floor(goal / cols);
        // Octile distance at the cheapest cost keeps the heuristic admissible.
        const heuristic = (index: number) => {
            const dc = Math.abs((index % cols) - gc);
            const dr = Math.abs(Math.floor(index / cols) - gr);

            return (
                (Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr)) *
                COST.preferred
            );
        };

        const open = new Heap(f);
        g[start] = 0;
        f[start] = heuristic(start);
        open.push(start);

        while (open.size > 0) {
            const current = open.pop();

            if (current === goal) {
                break;
            }

            if (closed[current]) {
                continue;
            }

            closed[current] = 1;
            const c = current % cols;
            const r = Math.floor(current / cols);

            for (const [dc, dr, step] of NEIGHBOURS) {
                const nc = c + dc;
                const nr = r + dr;

                if (!walkable(nc, nr)) {
                    continue;
                }

                // No squeezing diagonally past a wall corner.
                if (
                    dc !== 0 &&
                    dr !== 0 &&
                    (!walkable(c + dc, r) || !walkable(c, r + dr))
                ) {
                    continue;
                }

                const next = nr * cols + nc;
                const tentative =
                    g[current] + step * ((cost[current] + cost[next]) / 2);

                if (tentative < g[next]) {
                    g[next] = tentative;
                    f[next] = tentative + heuristic(next);
                    cameFrom[next] = current;
                    open.push(next);
                }
            }
        }

        if (cameFrom[goal] === -1) {
            return null;
        }

        const cells: number[] = [];

        for (let at = goal; at !== -1; at = cameFrom[at]) {
            cells.push(at);
        }

        cells.reverse();

        // String-pulling: keep only the corners needed to stay on walkable ground.
        const corners = [cells[0]];
        let anchor = 0;

        for (let i = 2; i < cells.length; i++) {
            if (!clearLine(cells[anchor], cells[i])) {
                corners.push(cells[i - 1]);
                anchor = i - 1;
            }
        }

        corners.push(cells[cells.length - 1]);

        return corners.map(toPoint);
    };

    return { route };
}

// ---------------------------------------------------------------------------
// Turn-by-turn guidance
// ---------------------------------------------------------------------------

export type Meters = { east: number; north: number };

export type Maneuver = {
    /** Metres along the route where the turn happens. */
    at: number;
    /** Degrees, negative = left. */
    turn: number;
    /** "turn left", "keep slightly right", "make a sharp left". */
    phrase: string;
};

export type RouteGuide = {
    points: MapPoint[];
    meters: Meters[];
    /** Distance from the start to each point. */
    cumulative: number[];
    /** Compass bearing of each leg. */
    bearings: number[];
    length: number;
    maneuvers: Maneuver[];
};

// Bends gentler than this are just "keep going".
const MIN_TURN_DEGREES = 25;
// Legs shorter than this get merged, so GPS-scale wiggles aren't announced.
const MIN_LEG_METERS = 3;

function bearingOf(a: Meters, b: Meters) {
    return (
        ((Math.atan2(b.east - a.east, b.north - a.north) * 180) / Math.PI +
            360) %
        360
    );
}

function signedTurn(fromBearing: number, toBearing: number) {
    return ((toBearing - fromBearing + 540) % 360) - 180;
}

function phraseFor(turn: number) {
    const side = turn < 0 ? 'left' : 'right';
    const amount = Math.abs(turn);

    if (amount < 55) {
        return `keep slightly ${side}`;
    }

    if (amount < 135) {
        return `turn ${side}`;
    }

    return `make a sharp ${side}`;
}

/**
 * @param toMeters converts a map point to metres east/north of some fixed
 *   origin (see GeoProjector.offsetMeters).
 */
export function buildGuide(
    points: MapPoint[],
    toMeters: (p: MapPoint) => Meters,
): RouteGuide {
    // Drop legs too short to matter before working out the turns.
    const kept: MapPoint[] = [points[0]];
    const keptMeters: Meters[] = [toMeters(points[0])];

    for (let i = 1; i < points.length; i++) {
        const m = toMeters(points[i]);
        const last = keptMeters[keptMeters.length - 1];
        const isLast = i === points.length - 1;

        if (
            Math.hypot(m.east - last.east, m.north - last.north) >=
                MIN_LEG_METERS ||
            isLast
        ) {
            if (
                isLast &&
                kept.length > 1 &&
                Math.hypot(m.east - last.east, m.north - last.north) <
                    MIN_LEG_METERS
            ) {
                kept[kept.length - 1] = points[i];
                keptMeters[keptMeters.length - 1] = m;
            } else {
                kept.push(points[i]);
                keptMeters.push(m);
            }
        }
    }

    if (kept.length === 1) {
        kept.push(kept[0]);
        keptMeters.push(keptMeters[0]);
    }

    const cumulative = [0];
    const bearings: number[] = [];

    for (let i = 1; i < keptMeters.length; i++) {
        const a = keptMeters[i - 1];
        const b = keptMeters[i];
        cumulative.push(
            cumulative[i - 1] + Math.hypot(b.east - a.east, b.north - a.north),
        );
        bearings.push(bearingOf(a, b));
    }

    const maneuvers: Maneuver[] = [];

    for (let i = 1; i < bearings.length; i++) {
        const turn = signedTurn(bearings[i - 1], bearings[i]);

        if (Math.abs(turn) >= MIN_TURN_DEGREES) {
            maneuvers.push({
                at: cumulative[i],
                turn,
                phrase: phraseFor(turn),
            });
        }
    }

    return {
        points: kept,
        meters: keptMeters,
        cumulative,
        bearings,
        length: cumulative[cumulative.length - 1],
        maneuvers,
    };
}

export type RouteProgress = {
    /** Metres travelled along the route. */
    along: number;
    /** Metres between the walker and the route. */
    offRoute: number;
    /** Index of the leg the walker is on. */
    leg: number;
};

/**
 * Where the walker is along the route. Only legs at or beyond `minAlong`
 * (less a little slack) are considered, so a route that doubles back doesn't
 * make progress jump backwards.
 */
export function locateOnRoute(
    guide: RouteGuide,
    position: Meters,
    minAlong = 0,
): RouteProgress {
    let best: RouteProgress = { along: 0, offRoute: Infinity, leg: 0 };

    for (let i = 1; i < guide.meters.length; i++) {
        if (guide.cumulative[i] < minAlong - 10) {
            continue;
        }

        const a = guide.meters[i - 1];
        const b = guide.meters[i];
        const dx = b.east - a.east;
        const dy = b.north - a.north;
        const lengthSq = dx * dx + dy * dy;
        const t =
            lengthSq === 0
                ? 0
                : Math.max(
                      0,
                      Math.min(
                          1,
                          ((position.east - a.east) * dx +
                              (position.north - a.north) * dy) /
                              lengthSq,
                      ),
                  );
        const px = a.east + t * dx;
        const py = a.north + t * dy;
        const distance = Math.hypot(position.east - px, position.north - py);

        if (distance < best.offRoute) {
            best = {
                along: guide.cumulative[i - 1] + t * Math.sqrt(lengthSq),
                offRoute: distance,
                leg: i - 1,
            };
        }
    }

    return best;
}

/** Walking distance rounded the way people say it: "8 m", "40 m", "150 m". */
export function spokenDistance(meters: number) {
    if (meters < 10) {
        return `${Math.max(1, Math.round(meters))} m`;
    }

    return `${Math.round(meters / 10) * 10} m`;
}

export type Instruction = {
    /** Shown on screen. */
    text: string;
    /** The upcoming turn, if any, and how far away it is. */
    maneuver: Maneuver | null;
    distance: number;
};

/** Distance at which the upcoming turn is shown as "Turn left now". */
export const TURN_NOW_METERS = 6;

export function instructionAt(
    guide: RouteGuide,
    along: number,
    destination: string,
): Instruction {
    const next = guide.maneuvers.find((m) => m.at > along + 1) ?? null;
    const toTurn = next ? next.at - along : guide.length - along;

    if (!next) {
        return {
            text: `Continue ${spokenDistance(Math.max(0, toTurn))} to ${destination}`,
            maneuver: null,
            distance: toTurn,
        };
    }

    const phrase = next.phrase.charAt(0).toUpperCase() + next.phrase.slice(1);

    return {
        text:
            toTurn <= TURN_NOW_METERS
                ? `${phrase} now`
                : `In ${spokenDistance(toTurn)}, ${next.phrase}`,
        maneuver: next,
        distance: toTurn,
    };
}
