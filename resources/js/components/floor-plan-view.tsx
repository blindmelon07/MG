import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MapPoint } from '@/lib/campus-route';
import type { FloorPlan, Room, RoomKind } from '@/lib/floor-plans';
import { cn } from '@/lib/utils';

// Plan units are large (a room is ~10 wide); shrink them into a scene that
// suits the camera.
const SCALE = 0.1;
const WALL_HEIGHT = 0.32;
const ROUTE_COLOR = 0x2563eb;

const ROOM_COLORS: Record<RoomKind, number> = {
    office: 0xf5d77a,
    classroom: 0xf1e4b8,
    lab: 0xe9d8a6,
    stairs: 0xc8c2b4,
    open: 0x9cc58a,
    outside: 0x9cc58a,
};

type Label = {
    key: string;
    text: string;
    x: number;
    y: number;
    target: boolean;
};

/**
 * One floor of a building in 3D, dollhouse style: rooms as low open boxes,
 * the destination raised and coloured, and the walk from the entrance drawn
 * along the hallways with a marker moving along it.
 */
export function FloorPlanView({
    plan,
    target,
    route,
    names,
    className,
}: {
    plan: FloorPlan;
    target: Room | null;
    route: MapPoint[] | null;
    /** Room key → what's in it (e.g. "Electronics Laboratory"), from the Directory. */
    names?: Record<string, string>;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const labelRefs = useRef(new Map<string, HTMLDivElement>());

    const labels: Label[] = [
        ...plan.rooms
            .filter((r) => r.kind !== 'stairs' || r === target)
            .map((r) => ({
                key: r.key,
                text: names?.[r.key] ?? r.name,
                x: r.x + r.w / 2,
                y: r.y + r.d / 2,
                target: r === target,
            })),
        ...(route && route.length > 0
            ? [
                  {
                      key: '__start',
                      text: 'Enter here',
                      x: route[0].x,
                      y: route[0].y,
                      target: false,
                  },
              ]
            : []),
    ];
    const labelsRef = useRef(labels);

    useEffect(() => {
        labelsRef.current = labels;
    });

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const w = plan.width * SCALE;
        const d = plan.depth * SCALE;
        const toWorld = (p: MapPoint) =>
            new THREE.Vector3(p.x * SCALE - w / 2, 0, p.y * SCALE - d / 2);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        const focus = target
            ? toWorld({
                  x: target.x + target.w / 2,
                  y: target.y + target.d / 2,
              })
            : new THREE.Vector3(0, 0, 0);
        camera.position.set(focus.x * 0.4, Math.max(w, d) * 0.95, d * 0.95);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(focus.x * 0.4, 0, focus.z * 0.3);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = 2;
        controls.maxDistance = 14;
        controls.maxPolarAngle = Math.PI / 2 - 0.15;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.2));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(3, 8, 5);
        scene.add(sun);

        const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
        const add = (
            geometry: THREE.BufferGeometry,
            material: THREE.Material,
            position: THREE.Vector3,
        ) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            scene.add(mesh);
            disposables.push(geometry, material);

            return mesh;
        };

        // Base slab under the whole floor.
        add(
            new THREE.BoxGeometry(w + 0.2, 0.06, d + 0.2),
            new THREE.MeshStandardMaterial({ color: 0x8b8e92 }),
            new THREE.Vector3(0, -0.04, 0),
        );

        // Hallways: pale floor.
        for (const hall of plan.halls) {
            const c = toWorld({
                x: hall.x + hall.w / 2,
                y: hall.y + hall.d / 2,
            });
            add(
                new THREE.BoxGeometry(hall.w * SCALE, 0.02, hall.d * SCALE),
                new THREE.MeshStandardMaterial({ color: 0xf3f4f6 }),
                c.setY(0.0),
            );
        }

        // Rooms: low walls around a tinted floor; the destination stands taller.
        for (const room of plan.rooms) {
            const isTarget = room === target;
            const c = toWorld({
                x: room.x + room.w / 2,
                y: room.y + room.d / 2,
            });
            const rw = room.w * SCALE;
            const rd = room.d * SCALE;

            if (room.kind === 'open' || room.kind === 'outside') {
                add(
                    new THREE.BoxGeometry(rw, 0.02, rd),
                    new THREE.MeshStandardMaterial({
                        color: ROOM_COLORS[room.kind],
                    }),
                    c.clone().setY(0.005),
                );
                continue;
            }

            const color = isTarget ? 0xdc2626 : ROOM_COLORS[room.kind];
            const height = isTarget ? WALL_HEIGHT * 1.8 : WALL_HEIGHT;
            add(
                new THREE.BoxGeometry(rw, 0.03, rd),
                new THREE.MeshStandardMaterial({ color }),
                c.clone().setY(0.01),
            );

            const wallMat = new THREE.MeshStandardMaterial({
                color: isTarget ? 0xef4444 : 0xd8cdb6,
                transparent: !isTarget,
                opacity: isTarget ? 1 : 0.92,
            });
            const t = 0.03;
            const walls: [number, number, number, number][] = [
                [0, -rd / 2, rw, t], // north
                [0, rd / 2, rw, t], // south
                [-rw / 2, 0, t, rd], // west
                [rw / 2, 0, t, rd], // east
            ];
            const doorSide = { north: 0, south: 1, west: 2, east: 3 }[
                room.door
            ];

            walls.forEach(([dx, dz, ww, wd], i) => {
                // The door wall gets a gap in the middle.
                if (i === doorSide) {
                    const along = i < 2 ? ww : wd;
                    const gap = Math.min(0.18, along * 0.4);
                    const piece = (along - gap) / 2;

                    for (const sign of [-1, 1]) {
                        const offset = sign * (gap / 2 + piece / 2);
                        add(
                            new THREE.BoxGeometry(
                                i < 2 ? piece : ww,
                                height,
                                i < 2 ? wd : piece,
                            ),
                            wallMat,
                            new THREE.Vector3(
                                c.x + dx + (i < 2 ? offset : 0),
                                height / 2,
                                c.z + dz + (i < 2 ? 0 : offset),
                            ),
                        );
                    }

                    return;
                }

                add(
                    new THREE.BoxGeometry(ww, height, wd),
                    wallMat,
                    new THREE.Vector3(c.x + dx, height / 2, c.z + dz),
                );
            });
        }

        // The walk: a ribbon along the hallways, and a dot walking it.
        let walker: THREE.Mesh | null = null;
        const legs: { a: THREE.Vector3; b: THREE.Vector3; length: number }[] =
            [];

        if (route && route.length > 1) {
            for (let i = 1; i < route.length; i++) {
                const a = toWorld(route[i - 1]).setY(0.03);
                const b = toWorld(route[i]).setY(0.03);
                const length = a.distanceTo(b);
                legs.push({ a, b, length });
                const mid = a.clone().add(b).multiplyScalar(0.5);
                const segment = add(
                    new THREE.BoxGeometry(0.09, 0.015, length + 0.09),
                    new THREE.MeshBasicMaterial({ color: ROUTE_COLOR }),
                    mid,
                );
                segment.lookAt(b.x, 0.03, b.z);
            }

            walker = add(
                new THREE.SphereGeometry(0.08, 20, 12),
                new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }),
                legs[0].a.clone().setY(0.1),
            );
        }

        const total = legs.reduce((sum, l) => sum + l.length, 0);

        const resize = () => {
            const cw = container.clientWidth;
            const ch = container.clientHeight;

            if (cw === 0 || ch === 0) {
                return;
            }

            camera.aspect = cw / ch;
            camera.updateProjectionMatrix();
            renderer.setSize(cw, ch);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        let frame = 0;
        const started = performance.now();
        const tick = () => {
            frame = requestAnimationFrame(tick);
            controls.update();

            // Walk the route over ~6 s, pause, repeat.
            if (walker && total > 0) {
                const cycle = ((performance.now() - started) / 7000) % 1;
                let left = Math.min(1, cycle / 0.85) * total;

                for (const leg of legs) {
                    if (left <= leg.length) {
                        walker.position
                            .copy(leg.a)
                            .lerp(leg.b, leg.length ? left / leg.length : 0)
                            .setY(0.1);
                        break;
                    }

                    left -= leg.length;
                }
            }

            renderer.render(scene, camera);

            for (const label of labelsRef.current) {
                const el = labelRefs.current.get(label.key);

                if (!el) {
                    continue;
                }

                const v = toWorld({ x: label.x, y: label.y })
                    .setY(label.target ? WALL_HEIGHT * 2.2 : WALL_HEIGHT)
                    .project(camera);
                el.style.display = v.z < 1 ? '' : 'none';
                el.style.left = `${(v.x * 0.5 + 0.5) * container.clientWidth}px`;
                el.style.top = `${(-v.y * 0.5 + 0.5) * container.clientHeight}px`;
            }
        };
        tick();

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            controls.dispose();
            disposables.forEach((item) => item.dispose());
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [plan, target, route]);

    return (
        <div
            className={cn(
                'relative h-full w-full touch-none overflow-hidden bg-sky-50 select-none dark:bg-slate-950',
                className,
            )}
        >
            <div ref={containerRef} className="absolute inset-0" />
            {labels.map((label) => (
                <div
                    key={label.key}
                    ref={(el) => {
                        if (el) {
                            labelRefs.current.set(label.key, el);
                        } else {
                            labelRefs.current.delete(label.key);
                        }
                    }}
                    className={cn(
                        'pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded px-1.5 py-0.5 text-center text-[11px] leading-tight font-semibold whitespace-nowrap shadow',
                        label.target
                            ? 'z-10 bg-red-600 px-2.5 py-1 text-sm text-white'
                            : label.key === '__start'
                              ? 'z-10 bg-blue-600 text-white'
                              : 'bg-background/85 text-foreground',
                    )}
                >
                    {label.text}
                </div>
            ))}
        </div>
    );
}
