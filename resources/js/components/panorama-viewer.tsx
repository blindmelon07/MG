import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CampusPanorama } from '@/lib/panorama';
import { cn } from '@/lib/utils';

const SPHERE_RADIUS = 50;
const DEFAULT_FOV = 75;
const MIN_FOV = 30;
const MAX_FOV = 95;
const MAX_PITCH = 85;
// Per-frame easing toward the compass, so a shaky hand doesn't shake the view.
const TURN_EASING = 0.2;
const FADE_MS = 500;

/** What the viewer is looking at, for callers that need it (e.g. set north). */
export type PanoramaView = {
    /** Degrees across the photo from its left edge (0–360). */
    photoDegrees: number;
};

/** Shortest signed difference between two angles, in degrees. */
function degreesDelta(from: number, to: number) {
    return ((to - from + 540) % 360) - 180;
}

/**
 * A logo patch over the very bottom of the photo, where the camera's own
 * stick or tripod shows up.
 */
function createNadirPatch() {
    const geometry = new THREE.CircleGeometry(SPHERE_RADIUS * 0.16, 48);
    geometry.rotateX(-Math.PI / 2);
    const texture = new THREE.TextureLoader().load('/logo.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -SPHERE_RADIUS * 0.97;

    // White disc behind the logo, slightly larger, so it reads as a badge.
    const backingGeometry = new THREE.CircleGeometry(SPHERE_RADIUS * 0.18, 48);
    backingGeometry.rotateX(-Math.PI / 2);
    const backingMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
    });
    const backing = new THREE.Mesh(backingGeometry, backingMaterial);
    backing.position.y = mesh.position.y - 0.05;

    const group = new THREE.Group();
    group.add(backing, mesh);

    return {
        group,
        disposables: [
            geometry,
            texture,
            material,
            backingGeometry,
            backingMaterial,
        ],
    };
}

/**
 * A full 360° photo you stand inside. With a compass `heading` the view turns
 * as the phone turns; dragging looks around too, pinching zooms.
 *
 * The photo is drawn on the inside of a sphere: looking along angle a (in the
 * x/z plane) shows the column a/360 of the way across the image, so a
 * compass heading h shows column north_offset + h.
 */
export function PanoramaViewer({
    panorama,
    heading,
    viewRef,
    className,
    children,
}: {
    panorama: CampusPanorama;
    /** Compass heading the phone faces (degrees from north), when known. */
    heading?: number | null;
    /** Kept up to date with where the viewer is looking. */
    viewRef?: React.RefObject<PanoramaView | null>;
    className?: string;
    children?: React.ReactNode;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const compassRef = useRef<HTMLDivElement>(null);
    const panoramaRef = useRef(panorama);
    const headingRef = useRef(heading ?? null);
    const showRef = useRef<((next: CampusPanorama) => void) | null>(null);

    useEffect(() => {
        headingRef.current = heading ?? null;
    }, [heading]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 200);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        renderer.domElement.style.touchAction = 'none';

        const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32);
        // Draw on the inside, unmirrored.
        sphereGeometry.scale(-1, 1, 1);

        const nadir = createNadirPatch();
        scene.add(nadir.group);

        const loader = new THREE.TextureLoader();
        let current: THREE.Mesh<
            THREE.SphereGeometry,
            THREE.MeshBasicMaterial
        > | null = null;
        let fading: {
            mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
            start: number;
        } | null = null;
        let loadToken = 0;

        function disposeMesh(
            mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>,
        ) {
            scene.remove(mesh);
            mesh.material.map?.dispose();
            mesh.material.dispose();
        }

        // Where the view points, in degrees across the photo, plus pitch.
        let photoDegrees = panoramaRef.current.north_offset;
        // Extra turn from dragging, on top of the compass.
        let dragDegrees = 0;
        let pitch = 0;

        /** Loads a photo and fades it in over the one showing. */
        function show(next: CampusPanorama) {
            const token = ++loadToken;
            const previous = panoramaRef.current;
            panoramaRef.current = next;

            // Keep facing the same real-world way across photos.
            photoDegrees += next.north_offset - previous.north_offset;

            loader.load(next.url, (texture) => {
                if (token !== loadToken) {
                    texture.dispose();

                    return;
                }

                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: current ? 0 : 1,
                    depthWrite: false,
                });
                const mesh = new THREE.Mesh(sphereGeometry, material);
                // Draw the newcomer over the old photo while it fades in.
                mesh.renderOrder = 1;
                scene.add(mesh);

                if (fading) {
                    disposeMesh(fading.mesh);
                }

                if (current) {
                    fading = { mesh: current, start: performance.now() };
                    current.renderOrder = 0;
                }

                current = mesh;
            });
        }

        showRef.current = show;
        show(panoramaRef.current);

        const resize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;

            if (w === 0 || h === 0) {
                return;
            }

            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        resize();

        let raf = 0;

        function animate() {
            const compass = headingRef.current;

            if (compass !== null) {
                const target =
                    panoramaRef.current.north_offset + compass + dragDegrees;
                photoDegrees +=
                    degreesDelta(photoDegrees, target) * TURN_EASING;
            }

            photoDegrees = ((photoDegrees % 360) + 360) % 360;

            if (viewRef) {
                viewRef.current = { photoDegrees };
            }

            const a = photoDegrees * (Math.PI / 180);
            const p = pitch * (Math.PI / 180);
            camera.lookAt(
                Math.cos(a) * Math.cos(p),
                Math.sin(p),
                Math.sin(a) * Math.cos(p),
            );

            // North marker: how far left or right of the view north lies.
            if (compassRef.current) {
                const northTurn = degreesDelta(
                    photoDegrees,
                    panoramaRef.current.north_offset,
                );
                compassRef.current.style.transform = `rotate(${northTurn}deg)`;
            }

            if (fading && current) {
                const t = Math.min(
                    1,
                    (performance.now() - fading.start) / FADE_MS,
                );
                current.material.opacity = t;

                if (t >= 1) {
                    disposeMesh(fading.mesh);
                    fading = null;
                }
            }

            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
        }

        animate();

        // Drag to look around (the scene follows the finger), pinch or
        // scroll to zoom.
        const pointers = new Map<number, { x: number; y: number }>();

        const span = () => {
            const [a, b] = [...pointers.values()];

            return Math.hypot(a.x - b.x, a.y - b.y);
        };

        const zoom = (factor: number) => {
            camera.fov = Math.min(
                MAX_FOV,
                Math.max(MIN_FOV, camera.fov * factor),
            );
            camera.updateProjectionMatrix();
        };

        function handlePointerDown(e: PointerEvent) {
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            renderer.domElement.setPointerCapture(e.pointerId);
        }

        function handlePointerMove(e: PointerEvent) {
            const last = pointers.get(e.pointerId);

            if (!last) {
                return;
            }

            if (pointers.size >= 2) {
                const before = span();
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const after = span();

                if (before > 0 && after > 0) {
                    zoom(before / after);
                }

                return;
            }

            const degreesPerPixel = camera.fov / container!.clientHeight;
            const dx = (e.clientX - last.x) * degreesPerPixel;
            const dy = (e.clientY - last.y) * degreesPerPixel;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (headingRef.current !== null) {
                dragDegrees -= dx;
            } else {
                photoDegrees -= dx;
            }

            pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch + dy));
        }

        function handlePointerUp(e: PointerEvent) {
            pointers.delete(e.pointerId);
        }

        function handleWheel(e: WheelEvent) {
            e.preventDefault();
            zoom(Math.exp(e.deltaY * 0.001));
        }

        const el = renderer.domElement;
        el.addEventListener('pointerdown', handlePointerDown);
        el.addEventListener('pointermove', handlePointerMove);
        el.addEventListener('pointerup', handlePointerUp);
        el.addEventListener('pointercancel', handlePointerUp);
        el.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            el.removeEventListener('pointerdown', handlePointerDown);
            el.removeEventListener('pointermove', handlePointerMove);
            el.removeEventListener('pointerup', handlePointerUp);
            el.removeEventListener('pointercancel', handlePointerUp);
            el.removeEventListener('wheel', handleWheel);
            showRef.current = null;

            if (current) {
                disposeMesh(current);
            }

            if (fading) {
                disposeMesh(fading.mesh);
            }

            sphereGeometry.dispose();
            nadir.disposables.forEach((d) => d.dispose());
            renderer.dispose();
            container.removeChild(el);
        };
    }, [viewRef]);

    // Swap photos without rebuilding the scene.
    useEffect(() => {
        if (
            panoramaRef.current.id !== panorama.id ||
            panoramaRef.current.url !== panorama.url
        ) {
            showRef.current?.(panorama);
        } else {
            panoramaRef.current = panorama;
        }
    }, [panorama]);

    return (
        <div
            className={cn(
                'relative overflow-hidden bg-slate-900 select-none',
                className,
            )}
        >
            <div ref={containerRef} className="absolute inset-0" />

            {/* North marker: the arrow points to real-world north. */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-2 left-2 flex size-10 items-center justify-center rounded-full bg-background/90 shadow-md backdrop-blur"
            >
                <div
                    ref={compassRef}
                    className="flex flex-col items-center leading-none"
                >
                    <span className="text-[10px] font-bold text-red-600">
                        N
                    </span>
                    <span className="block h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-red-600" />
                </div>
            </div>

            {children}
        </div>
    );
}
