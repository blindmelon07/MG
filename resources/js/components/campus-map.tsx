import { MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cn } from '@/lib/utils';

export type CampusMapPoint = {
    id: number;
    name: string;
    description: string | null;
    x: number;
    y: number;
};

// World-space footprint of the campus plot, in arbitrary Three.js units.
// CampusLocation.x/y are still stored as a 0-100 percent across this plot,
// so the database and the admin picker don't care whether the scene behind
// them is flat SVG or a real 3D world.
// Proportions follow the printed Aemilianum College site plan (north = top),
// including the frontage road along the bottom edge.
const SITE_WIDTH = 16;
const SITE_DEPTH = 12.8;

function percentToWorld(x: number, y: number) {
    return {
        x: (x / 100) * SITE_WIDTH - SITE_WIDTH / 2,
        z: (y / 100) * SITE_DEPTH - SITE_DEPTH / 2,
    };
}

function worldToPercent(x: number, z: number) {
    return {
        x: Math.min(
            100,
            Math.max(0, ((x + SITE_WIDTH / 2) / SITE_WIDTH) * 100),
        ),
        y: Math.min(
            100,
            Math.max(0, ((z + SITE_DEPTH / 2) / SITE_DEPTH) * 100),
        ),
    };
}

type GridBox = { col: number; row: number; w: number; d: number };

function gridCenter({ col, row, w, d }: GridBox) {
    return {
        x: col - SITE_WIDTH / 2 + w / 2,
        z: row - SITE_DEPTH / 2 + d / 2,
    };
}

// Colours sampled from the ACI virtual tour photos: granite-wash beige
// walls, flat concrete roof slabs, open corridors with green window grilles.
const WALL_COLOR = '#cdbfa3';
const PLAIN_WALL_COLOR = 0xd8cdb6;
const ROOF_COLOR = 0xa8a59c;
const GYM_ROOF_COLOR = 0xb8b24c; // yellow-green roof beside the chapel
const WALKWAY_ROOF_COLOR = 0x8d8a82;

// One wall-texture tile covers one corridor bay across one storey.
const BAY_WIDTH = 0.45;
const STOREY_HEIGHT = 0.8;

type Building = GridBox & {
    h: number;
    /** Open-corridor classroom facade; otherwise a plain wall. */
    corridors?: boolean;
    wall?: number;
    roof?: number;
    /** Outward-facing walls that get the hooded-window facade instead. */
    exterior?: Face[];
};

type Face = 'east' | 'west' | 'south' | 'north';

// BoxGeometry material index for each wall: +x, -x, +z, -z
const FACE_INDEX: Record<Face, number> = {
    east: 0,
    west: 1,
    south: 4,
    north: 5,
};

const BUILDINGS: Building[] = [
    // ACI Gymnasium two-storey north annex (the hall itself is buildGym)
    {
        col: 2.9,
        row: 3.9,
        w: 2.5,
        d: 0.86,
        h: 1.6,
        wall: 0xe3d5a8,
        roof: GYM_ROOF_COLOR,
    },
    // Convent
    { col: 7.63, row: 3.92, w: 1.36, d: 1.02, h: 1.6, corridors: true },
    // Main Building — high school wing, central block, college wing.
    // Corridors face the courtyards; outer walls have hooded windows.
    {
        col: 7.93,
        row: 5.05,
        w: 7.7,
        d: 1.07,
        h: 1.6,
        corridors: true,
        exterior: ['north', 'east'],
    },
    { col: 10.0, row: 6.12, w: 1.3, d: 2.16, h: 1.6, corridors: true },
    {
        col: 8.26,
        row: 8.28,
        w: 7.74,
        d: 1.06,
        h: 1.6,
        corridors: true,
        exterior: ['south', 'east'],
    },
    {
        col: 7.99,
        row: 6.12,
        w: 0.3,
        d: 2.16,
        h: 1.6,
        corridors: true,
        exterior: ['west'],
    },
    // Quadrangle stage
    { col: 12.07, row: 7.8, w: 1.47, d: 0.48, h: 0.5 },
    // AIT Building — two wings joined by a spine, annex to the south
    { col: 9.24, row: 0.05, w: 3.24, d: 0.57, h: 1.6, corridors: true },
    { col: 8.61, row: 1.08, w: 3.89, d: 0.59, h: 1.6, corridors: true },
    { col: 10.1, row: 0.62, w: 0.6, d: 1.53, h: 1.6, corridors: true },
    { col: 9.67, row: 2.15, w: 1.93, d: 1.13, h: 1.6, corridors: true },
    // Automotive Laboratory
    { col: 13.8, row: 3.28, w: 2.12, d: 0.32, h: 0.8, corridors: true },
    { col: 13.97, row: 3.6, w: 1.2, d: 0.6, h: 1 },
    // Canteen, garage, restrooms
    { col: 15.4, row: 4.07, w: 0.5, d: 0.8, h: 0.7 },
    { col: 9.18, row: 3.66, w: 0.54, d: 0.41, h: 0.6 },
    { col: 9.72, row: 4.44, w: 0.65, d: 0.57, h: 0.6 },
];

// Covered walks: low, thin roofs linking the gate and the AIT Building.
const WALKWAYS: GridBox[] = [
    { col: 8.37, row: 9.68, w: 0.24, d: 2.37 },
    { col: 10.38, row: 3.28, w: 0.18, d: 1.77 },
];

const PATCHES: (GridBox & { color: number })[] = [
    { col: 0, row: 12.1, w: SITE_WIDTH, d: 0.7, color: 0x4b5563 }, // road to Sorsogon City proper
    { col: 6.96, row: 9.36, w: 1.41, d: 2.74, color: 0x8b8e92 }, // main driveway
    { col: 6.4, row: 9.36, w: 0.56, d: 1.5, color: 0x7d8084 }, // parking space
    { col: 11.36, row: 6.12, w: 3.3, d: 2.16, color: 0x7d8084 }, // ACI quadrangle (asphalt)
    { col: 11.7, row: 6.56, w: 1.96, d: 1.08, color: 0x93969a }, // volleyball court
    { col: 9.0, row: 9.73, w: 3.88, d: 1.99, color: 0x6fae4f }, // soccer field
    { col: 13.4, row: 10.05, w: 1.33, d: 1.77, color: 0x9ca3af }, // basketball court
];

// Broad shade trees, as drawn on the printed map.
const TREES: { col: number; row: number }[] = [
    { col: 11.37, row: 4.6 },
    { col: 14.5, row: 4.57 },
    { col: 15.43, row: 7.26 },
    // Row of trees along the main driveway median
    { col: 7.66, row: 9.78 },
    { col: 7.66, row: 10.32 },
    { col: 7.66, row: 10.8 },
    { col: 7.66, row: 11.4 },
];

// Coconut palms line the campus edges in the tour photos.
const PALMS: { col: number; row: number }[] = [
    { col: 0.5, row: 1 },
    { col: 2.2, row: 0.5 },
    { col: 4, row: 0.8 },
    { col: 5.8, row: 0.4 },
    { col: 7.4, row: 0.9 },
    { col: 0.6, row: 3 },
    { col: 0.9, row: 5.2 },
    { col: 1.1, row: 7.4 },
    { col: 1.2, row: 9.6 },
    { col: 1.6, row: 11.4 },
    { col: 15.6, row: 0.8 },
    { col: 15.2, row: 2.2 },
    { col: 15.6, row: 5.9 },
    { col: 15.6, row: 10.3 },
    { col: 15.3, row: 11.4 },
    { col: 13.3, row: 1.9 },
];

/** A one-bay, one-storey tile of the open-corridor classroom facade. */
function createCorridorTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Granite-wash wall with a speckled finish
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 900; i++) {
        const shade = Math.random() < 0.5 ? 0 : 255;
        ctx.fillStyle = `rgba(${shade},${shade},${shade},0.08)`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }

    // Floor slab edge
    ctx.fillStyle = '#dcd9d1';
    ctx.fillRect(0, 0, size, 20);

    // Shaded corridor opening between the columns, above the parapet
    ctx.fillStyle = '#4a4843';
    ctx.fillRect(16, 20, size - 32, 58);

    // Green window grille on the classroom wall behind
    ctx.fillStyle = '#2f5d46';
    ctx.fillRect(42, 30, 52, 40);
    ctx.strokeStyle = '#1d3b2c';
    ctx.lineWidth = 2;

    for (let x = 42; x <= 94; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, 70);
        ctx.stroke();
    }

    // Square columns at each end of the bay
    ctx.fillStyle = '#bfb193';
    ctx.fillRect(0, 20, 16, size - 20);
    ctx.fillRect(size - 16, 20, 16, size - 20);

    // Parapet coping
    ctx.fillStyle = '#d6cbb2';
    ctx.fillRect(16, 78, size - 32, 5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;

    return texture;
}

type Disposable = THREE.BufferGeometry | THREE.Material | THREE.Texture;

/** Returns a helper that adds a shadowed mesh and tracks its geometry. */
function meshAdder(scene: THREE.Scene, disposables: Disposable[]) {
    return function add(
        geo: THREE.BufferGeometry,
        mat: THREE.Material | THREE.Material[],
        x: number,
        y: number,
        z: number,
    ) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        disposables.push(geo);

        return mesh;
    };
}

/** Scales a box's wall UVs so the facade tile repeats per bay and storey. */
function tileWallUVs(
    geo: THREE.BoxGeometry,
    { w, h, d }: { w: number; h: number; d: number },
    bayWidth = BAY_WIDTH,
    storeyHeight = STOREY_HEIGHT,
) {
    const uv = geo.attributes.uv;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
    const faceSizes: [number, number][] = [
        [d, h],
        [d, h],
        [w, d],
        [w, d],
        [w, h],
        [w, h],
    ];

    faceSizes.forEach(([fw, fh], face) => {
        const repeatU = Math.max(1, Math.round(fw / bayWidth));
        const repeatV = Math.max(1, Math.round(fh / storeyHeight));

        for (let i = face * 4; i < face * 4 + 4; i++) {
            uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV);
        }
    });

    uv.needsUpdate = true;
}

// St. Jerome Emiliani Chapel footprint; its entrance faces south.
const CHAPEL: GridBox = { col: 6.33, row: 6.24, w: 1.66, d: 3.1 };

/** The sign band text above the chapel's arcade. */
function createChapelSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#9a9790';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e3a8a';
    ctx.strokeText('ST. JEROME EMILIANI', 256, 34);
    ctx.fillStyle = '#e0e7ff';
    ctx.fillText('ST. JEROME EMILIANI', 256, 34);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

/**
 * The chapel as seen in the tour: a triple-arched porch under a sign band,
 * with a curved concrete bell tower pierced by two round openings and
 * topped by a cross.
 */
function buildChapel(scene: THREE.Scene, disposables: Disposable[]) {
    const { w, d } = CHAPEL;
    const cx = gridCenter(CHAPEL).x;
    const front = CHAPEL.row + d - SITE_DEPTH / 2;

    const porchDepth = 0.45;
    const arcadeHeight = 0.8;
    const bandHeight = 0.22;
    const towerHeight = 1.35;
    const towerBase = arcadeHeight + bandHeight;

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0xcfc8b8,
        roughness: 0.95,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x8f8c86,
        roughness: 0.95,
    });
    const signTexture = createChapelSignTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture });
    disposables.push(wallMat, concreteMat, signTexture, signMat);

    const add = meshAdder(scene, disposables);

    // Nave behind the porch
    const naveDepth = d - porchDepth;
    add(
        new THREE.BoxGeometry(w, 1.1, naveDepth),
        wallMat,
        cx,
        0.55,
        front - porchDepth - naveDepth / 2,
    );

    // Front arcade: a wall with three round-headed arches
    const arcade = new THREE.Shape();
    arcade.moveTo(-w / 2, 0);
    arcade.lineTo(w / 2, 0);
    arcade.lineTo(w / 2, arcadeHeight);
    arcade.lineTo(-w / 2, arcadeHeight);
    arcade.closePath();

    const bay = w / 3;
    const pier = 0.07;
    const radius = (bay - pier * 2) / 2;
    const springLine = arcadeHeight * 0.55;

    for (let i = 0; i < 3; i++) {
        const x0 = -w / 2 + i * bay + pier;
        const arch = new THREE.Path();
        // Start just above the ground so the hole doesn't touch the outline.
        arch.moveTo(x0, 0.02);
        arch.lineTo(x0, springLine);
        arch.absarc(x0 + radius, springLine, radius, Math.PI, 0, true);
        arch.lineTo(x0 + radius * 2, 0.02);
        arch.closePath();
        arcade.holes.push(arch);
    }

    add(
        new THREE.ExtrudeGeometry(arcade, { depth: 0.06, bevelEnabled: false }),
        wallMat,
        cx,
        0,
        front - 0.06,
    );

    // Porch roof with the sign band facing the driveway
    add(
        new THREE.BoxGeometry(w + 0.06, bandHeight, porchDepth),
        [
            concreteMat,
            concreteMat,
            concreteMat,
            concreteMat,
            signMat,
            concreteMat,
        ],
        cx,
        arcadeHeight + bandHeight / 2,
        front - porchDepth / 2,
    );

    // Bell tower: straight on the west side, sweeping out to the east
    const tower = new THREE.Shape();
    tower.moveTo(0, 0);
    tower.lineTo(0, towerHeight);
    tower.lineTo(0.34, towerHeight);
    tower.quadraticCurveTo(0.34, 0, 0.83, 0);
    tower.closePath();
    tower.holes.push(
        new THREE.Path().absarc(0.17, towerHeight - 0.2, 0.1, 0, Math.PI * 2),
        new THREE.Path().absarc(0.17, 0.35, 0.09, 0, Math.PI * 2),
    );

    const towerLeft = cx - 0.15;
    const towerZ = front - porchDepth + 0.05;
    add(
        new THREE.ExtrudeGeometry(tower, { depth: 0.2, bevelEnabled: false }),
        concreteMat,
        towerLeft,
        towerBase,
        towerZ,
    );

    // Cross rising beside the tower's west edge
    const crossX = towerLeft - 0.03;
    const crossZ = towerZ + 0.1;
    const top = towerBase + towerHeight;
    add(
        new THREE.BoxGeometry(0.03, 0.55, 0.03),
        concreteMat,
        crossX,
        top - 0.05,
        crossZ,
    );
    add(
        new THREE.BoxGeometry(0.2, 0.03, 0.03),
        concreteMat,
        crossX,
        top + 0.1,
        crossZ,
    );
}

// ACI Gymnasium main hall footprint; the gable roof ridge runs north–south.
const GYM: GridBox = { col: 1.9, row: 4.75, w: 4.1, d: 4.58 };
const GYM_WALL_COLOR = '#e3d5a8';
const GYM_BAY_WIDTH = 0.7;

/**
 * One full-height bay of the gym wall: open window band under a green
 * awning, breeze-block lattice below it, then solid wall, between pilasters.
 */
function createGymWallTexture() {
    const width = 128;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = GYM_WALL_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Open window band
    ctx.fillStyle = '#2b2a26';
    ctx.fillRect(0, 20, width, 64);

    // Green awning along the top of the windows
    ctx.fillStyle = '#2f7d5a';
    ctx.fillRect(0, 16, width, 9);

    // Breeze-block lattice panel
    ctx.fillStyle = '#d6c592';
    ctx.fillRect(0, 88, width, 62);
    ctx.fillStyle = '#9a8c62';

    for (let y = 92; y < 146; y += 9) {
        for (let x = 4; x < width; x += 9) {
            ctx.fillRect(x, y, 5, 5);
        }
    }

    // Pilasters at each end of the bay
    ctx.fillStyle = '#ecdfb8';
    ctx.fillRect(0, 16, 10, height - 16);
    ctx.fillRect(width - 10, 16, 10, height - 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;

    return texture;
}

/**
 * The gymnasium as seen in the tour: a tall hall under a low-pitched
 * yellow-green gable roof, with a one-storey wing and flat canopy along
 * its west side.
 */
function buildGym(scene: THREE.Scene, disposables: Disposable[]) {
    const { w, d } = GYM;
    const { x: cx, z: cz } = gridCenter(GYM);
    const north = GYM.row - SITE_DEPTH / 2;
    const west = GYM.col - SITE_WIDTH / 2;

    const eave = 2;
    const rise = 0.5;
    const overhang = 0.12;
    const roofThickness = 0.06;

    const wallTexture = createGymWallTexture();
    const wallMat = new THREE.MeshStandardMaterial({
        map: wallTexture,
        roughness: 0.95,
    });
    const plainMat = new THREE.MeshStandardMaterial({
        color: GYM_WALL_COLOR,
        roughness: 0.95,
    });
    const roofMat = new THREE.MeshStandardMaterial({
        color: GYM_ROOF_COLOR,
        roughness: 0.9,
    });
    disposables.push(wallTexture, wallMat, plainMat, roofMat);

    const add = meshAdder(scene, disposables);

    // Hall walls
    const hallGeo = new THREE.BoxGeometry(w, eave, d);
    tileWallUVs(hallGeo, { w, h: eave, d }, GYM_BAY_WIDTH, eave);
    add(
        hallGeo,
        [wallMat, wallMat, plainMat, plainMat, wallMat, wallMat],
        cx,
        eave / 2,
        cz,
    );

    // Gable ends: a triangular prism filling the space under the roof
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2, 0);
    gable.lineTo(w / 2, 0);
    gable.lineTo(0, rise);
    gable.closePath();
    add(
        new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }),
        plainMat,
        cx,
        eave,
        north,
    );

    // Two sloped roof slabs meeting at the ridge
    const pitch = Math.atan2(rise, w / 2);
    const slabLength = (w / 2 + overhang) / Math.cos(pitch);
    const slabGeo = new THREE.BoxGeometry(
        slabLength,
        roofThickness,
        d + overhang * 2,
    );

    for (const side of [1, -1]) {
        const slab = add(
            slabGeo,
            roofMat,
            cx + side * (slabLength / 2) * Math.cos(pitch),
            eave +
                rise -
                (slabLength / 2) * Math.sin(pitch) +
                roofThickness / 2,
            cz,
        );
        slab.rotation.z = -side * pitch;
    }

    // One-storey wing with a flat yellow canopy along the west wall
    const wingWidth = 0.45;
    const wingDepth = 3.2;
    const wingZ = cz + 0.2;
    add(
        new THREE.BoxGeometry(wingWidth, 0.7, wingDepth),
        plainMat,
        west - wingWidth / 2,
        0.35,
        wingZ,
    );
    add(
        new THREE.BoxGeometry(wingWidth + 0.15, 0.06, wingDepth + 0.1),
        roofMat,
        west - (wingWidth + 0.15) / 2,
        0.73,
        wingZ,
    );
}

/**
 * One bay, one storey of the Main Building's outer wall: weathered grey
 * concrete, a deep sun hood over a gridded window, pilasters either side.
 */
function createHoodedWindowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#8e8b84';
    ctx.fillRect(0, 0, size, size);

    // Rain streaks on the weathered concrete
    for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(40,38,34,0.08)';
        ctx.fillRect(Math.random() * size, 0, 2 + Math.random() * 4, size);
    }

    // Floor slab edge
    ctx.fillStyle = '#9c9992';
    ctx.fillRect(0, 0, size, 12);

    // Sloped sun hood and the shadow it casts
    ctx.fillStyle = '#a5a29b';
    ctx.fillRect(14, 16, size - 28, 18);
    ctx.fillStyle = '#4b4944';
    ctx.fillRect(14, 34, size - 28, 6);

    // Window with a grid of glass panes
    ctx.fillStyle = '#3d4448';
    ctx.fillRect(22, 42, size - 44, 56);
    ctx.strokeStyle = '#a3a9ac';
    ctx.lineWidth = 2;

    for (let x = 22; x <= size - 22; x += 21) {
        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, 98);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(22, 70);
    ctx.lineTo(size - 22, 70);
    ctx.stroke();

    // Sill
    ctx.fillStyle = '#9c9992';
    ctx.fillRect(18, 98, size - 36, 5);

    // Pilasters
    ctx.fillStyle = '#85827b';
    ctx.fillRect(0, 12, 12, size - 12);
    ctx.fillRect(size - 12, 12, 12, size - 12);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;

    return texture;
}

// Main entrance on the college wing's south face, toward the soccer field.
const MAIN_ENTRANCE = { col: 12.4, wallRow: 9.34 };

/** "AEMILIANUM ◉ COLLEGE" lettering on the entrance canopy. */
function createCollegeSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#8e8b84';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3f3d39';
    ctx.fillStyle = '#f1f1ee';

    for (const [text, x] of [
        ['AEMILIANUM', 140],
        ['COLLEGE', 400],
    ] as const) {
        ctx.strokeText(text, x, 66);
        ctx.fillText(text, x, 66);
    }

    // School seal between the words
    ctx.beginPath();
    ctx.arc(282, 64, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a227';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(282, 64, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#4d7c3a';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

/**
 * The Main Building's front entrance: a raised parapet block, a projecting
 * signed canopy on two columns, and the golden statue of St. Jerome
 * Emiliani with children on top.
 */
function buildMainEntrance(scene: THREE.Scene, disposables: Disposable[]) {
    const cx = MAIN_ENTRANCE.col - SITE_WIDTH / 2;
    const face = MAIN_ENTRANCE.wallRow - SITE_DEPTH / 2;

    const canopyBottom = 0.9;
    const canopyHeight = 0.37;
    const canopyDepth = 0.5;
    const canopyTop = canopyBottom + canopyHeight;

    const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x8e8b84,
        roughness: 0.95,
    });
    const signTexture = createCollegeSignTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture });
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        metalness: 0.6,
        roughness: 0.4,
    });
    disposables.push(concreteMat, signTexture, signMat, goldMat);

    const add = meshAdder(scene, disposables);

    // Raised parapet block rising above the roofline
    add(
        new THREE.BoxGeometry(0.66, 1.75, 0.3),
        concreteMat,
        cx,
        0.875,
        face - 0.05,
    );

    // Signed canopy projecting over the drop-off
    add(
        new THREE.BoxGeometry(1.1, canopyHeight, canopyDepth),
        [
            concreteMat,
            concreteMat,
            concreteMat,
            concreteMat,
            signMat,
            concreteMat,
        ],
        cx,
        canopyBottom + canopyHeight / 2,
        face + canopyDepth / 2,
    );

    const columnGeo = new THREE.BoxGeometry(0.09, canopyBottom, 0.09);

    for (const side of [-1, 1]) {
        add(
            columnGeo,
            concreteMat,
            cx + side * 0.47,
            canopyBottom / 2,
            face + 0.42,
        );
    }

    // Statue of St. Jerome Emiliani, cross raised, with two children
    const statueZ = face + 0.12;
    add(
        new THREE.CylinderGeometry(0.03, 0.05, 0.2, 8),
        goldMat,
        cx,
        canopyTop + 0.1,
        statueZ,
    );
    add(
        new THREE.SphereGeometry(0.03, 10, 8),
        goldMat,
        cx,
        canopyTop + 0.23,
        statueZ,
    );
    add(
        new THREE.TorusGeometry(0.045, 0.006, 6, 16),
        goldMat,
        cx,
        canopyTop + 0.25,
        statueZ - 0.02,
    );
    add(
        new THREE.BoxGeometry(0.01, 0.14, 0.01),
        goldMat,
        cx - 0.07,
        canopyTop + 0.28,
        statueZ,
    );
    add(
        new THREE.BoxGeometry(0.05, 0.01, 0.01),
        goldMat,
        cx - 0.07,
        canopyTop + 0.31,
        statueZ,
    );

    const childBodyGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.1, 8);
    const childHeadGeo = new THREE.SphereGeometry(0.02, 8, 6);

    for (const side of [-1, 1]) {
        add(
            childBodyGeo,
            goldMat,
            cx + side * 0.08,
            canopyTop + 0.05,
            statueZ + 0.04,
        );
        add(
            childHeadGeo,
            goldMat,
            cx + side * 0.08,
            canopyTop + 0.12,
            statueZ + 0.04,
        );
    }
}

// "I ♥ ACI" letters in a raised planter on the lawn west of the entrance.
const LOVE_ACI_SIGN = { col: 10.95, row: 9.54 };

function letterShapes() {
    const height = 0.3;

    const bar = new THREE.Shape();
    bar.moveTo(0, 0);
    bar.lineTo(0.09, 0);
    bar.lineTo(0.09, height);
    bar.lineTo(0, height);
    bar.closePath();

    // Classic bezier heart, flipped upright and scaled to letter height
    const s = 0.3 / 110;
    const p = (x: number, y: number): [number, number] => [
        (x + 30) * s,
        (95 - y) * s,
    ];
    const heart = new THREE.Shape();
    heart.moveTo(...p(25, 25));
    heart.bezierCurveTo(...p(25, 25), ...p(20, 0), ...p(0, 0));
    heart.bezierCurveTo(...p(-30, 0), ...p(-30, 35), ...p(-30, 35));
    heart.bezierCurveTo(...p(-30, 55), ...p(-10, 77), ...p(25, 95));
    heart.bezierCurveTo(...p(60, 77), ...p(80, 55), ...p(80, 35));
    heart.bezierCurveTo(...p(80, 35), ...p(80, 0), ...p(50, 0));
    heart.bezierCurveTo(...p(35, 0), ...p(25, 25), ...p(25, 25));

    const a = new THREE.Shape();
    a.moveTo(0, 0);
    a.lineTo(0.08, 0);
    a.lineTo(0.1, 0.08);
    a.lineTo(0.18, 0.08);
    a.lineTo(0.2, 0);
    a.lineTo(0.28, 0);
    a.lineTo(0.17, height);
    a.lineTo(0.11, height);
    a.closePath();
    const aHole = new THREE.Path();
    aHole.moveTo(0.115, 0.14);
    aHole.lineTo(0.165, 0.14);
    aHole.lineTo(0.14, 0.22);
    aHole.closePath();
    a.holes.push(aHole);

    // C: a thick ring open on the right
    const gap = 0.8;
    const c = new THREE.Shape();
    c.absarc(0.15, 0.15, 0.15, gap, Math.PI * 2 - gap, false);
    c.absarc(0.15, 0.15, 0.075, Math.PI * 2 - gap, gap, true);
    c.closePath();

    return [
        { shape: bar, width: 0.09, color: 0xe8d44d },
        { shape: heart, width: 0.3, color: 0xd9434e },
        { shape: a, width: 0.28, color: 0x5aa6d6 },
        { shape: c, width: 0.3, color: 0x8fd19e },
        { shape: bar, width: 0.09, color: 0xb39ddb },
    ];
}

/** The "I ♥ ACI" landmark: big painted letters on a curbed grass planter. */
function buildLoveAciSign(scene: THREE.Scene, disposables: Disposable[]) {
    const cx = LOVE_ACI_SIGN.col - SITE_WIDTH / 2;
    const cz = LOVE_ACI_SIGN.row - SITE_DEPTH / 2;
    const add = meshAdder(scene, disposables);

    const letters = letterShapes();
    const spacing = 0.05;
    const totalWidth =
        letters.reduce((sum, letter) => sum + letter.width, 0) +
        spacing * (letters.length - 1);

    // Planter: whitewashed curb with grass on top
    const curbHeight = 0.08;
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd6d3c8 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x6fae4f });
    disposables.push(curbMat, grassMat);
    add(
        new THREE.BoxGeometry(totalWidth + 0.2, curbHeight, 0.3),
        [curbMat, curbMat, grassMat, curbMat, curbMat, curbMat],
        cx,
        curbHeight / 2,
        cz,
    );

    const depth = 0.06;
    let x = cx - totalWidth / 2;

    for (const letter of letters) {
        const mat = new THREE.MeshStandardMaterial({
            color: letter.color,
            roughness: 0.7,
        });
        disposables.push(mat);
        add(
            new THREE.ExtrudeGeometry(letter.shape, {
                depth,
                bevelEnabled: false,
                curveSegments: 16,
            }),
            mat,
            x,
            curbHeight,
            cz - depth / 2,
        );
        x += letter.width + spacing;
    }
}

/** Builds the static campus scene once — the ground, buildings, trees. */
function buildScene(scene: THREE.Scene) {
    const disposables: Disposable[] = [];

    const hemi = new THREE.HemisphereLight(0xffffff, 0x4b5320, 0.75);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(hemi, sun);

    const groundGeo = new THREE.PlaneGeometry(SITE_WIDTH, SITE_DEPTH);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x9cc77f });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    disposables.push(groundGeo, groundMat);

    for (const patch of PATCHES) {
        const geo = new THREE.PlaneGeometry(patch.w, patch.d);
        const mat = new THREE.MeshStandardMaterial({ color: patch.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        const { x, z } = gridCenter(patch);
        mesh.position.set(x, 0.01, z);
        mesh.receiveShadow = true;
        scene.add(mesh);
        disposables.push(geo, mat);
    }

    const corridorTexture = createCorridorTexture();
    const corridorMat = new THREE.MeshStandardMaterial({
        map: corridorTexture,
        roughness: 0.95,
    });
    const hoodedTexture = createHoodedWindowTexture();
    const hoodedMat = new THREE.MeshStandardMaterial({
        map: hoodedTexture,
        roughness: 0.95,
    });
    disposables.push(hoodedTexture, hoodedMat);
    const roofMat = new THREE.MeshStandardMaterial({
        color: ROOF_COLOR,
        roughness: 0.9,
    });
    const walkwayMat = new THREE.MeshStandardMaterial({
        color: WALKWAY_ROOF_COLOR,
    });
    const plainWallMats = new Map<number, THREE.MeshStandardMaterial>();
    const edgesMat = new THREE.LineBasicMaterial({
        color: 0x57534e,
        transparent: true,
        opacity: 0.5,
    });
    disposables.push(
        corridorTexture,
        corridorMat,
        roofMat,
        walkwayMat,
        edgesMat,
    );

    function solidMaterial(color: number) {
        let mat = plainWallMats.get(color);

        if (!mat) {
            mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
            plainWallMats.set(color, mat);
            disposables.push(mat);
        }

        return mat;
    }

    for (const walk of WALKWAYS) {
        const geo = new THREE.BoxGeometry(walk.w, 0.05, walk.d);
        const mesh = new THREE.Mesh(geo, walkwayMat);
        const { x, z } = gridCenter(walk);
        mesh.position.set(x, 0.35, z);
        mesh.castShadow = true;
        scene.add(mesh);
        disposables.push(geo);
    }

    for (const building of BUILDINGS) {
        const geo = new THREE.BoxGeometry(building.w, building.h, building.d);
        const wall = building.corridors
            ? corridorMat
            : solidMaterial(building.wall ?? PLAIN_WALL_COLOR);
        const roof = building.roof ? solidMaterial(building.roof) : roofMat;

        if (building.corridors) {
            tileWallUVs(geo, building);
        }

        // BoxGeometry face order: +x, -x, +y (roof), -y, +z, -z
        const faces = [wall, wall, roof, wall, wall, wall];

        for (const face of building.exterior ?? []) {
            faces[FACE_INDEX[face]] = hoodedMat;
        }

        const mesh = new THREE.Mesh(geo, faces);
        const { x, z } = gridCenter(building);
        mesh.position.set(x, building.h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        disposables.push(geo);

        const edgesGeo = new THREE.EdgesGeometry(geo);
        const edges = new THREE.LineSegments(edgesGeo, edgesMat);
        edges.position.copy(mesh.position);
        scene.add(edges);
        disposables.push(edgesGeo);
    }

    buildGym(scene, disposables);
    buildChapel(scene, disposables);
    buildMainEntrance(scene, disposables);
    buildLoveAciSign(scene, disposables);

    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5a3a });
    const canopyGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a });
    disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);

    for (const tree of TREES) {
        const x = tree.col - SITE_WIDTH / 2;
        const z = tree.row - SITE_DEPTH / 2;

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 0.25, z);
        trunk.castShadow = true;
        scene.add(trunk);

        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(x, 0.65, z);
        canopy.castShadow = true;
        scene.add(canopy);
    }

    const palmTrunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 1.5, 6);
    palmTrunkGeo.translate(0, 0.75, 0);
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    const frondGeo = new THREE.BoxGeometry(0.55, 0.015, 0.1);
    frondGeo.translate(0.275, 0, 0); // pivot at the crown
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a });
    disposables.push(palmTrunkGeo, palmTrunkMat, frondGeo, frondMat);

    PALMS.forEach((palm, index) => {
        const palmGroup = new THREE.Group();
        palmGroup.position.set(
            palm.col - SITE_WIDTH / 2,
            0,
            palm.row - SITE_DEPTH / 2,
        );
        // Deterministic variety so the palms don't look cloned.
        palmGroup.rotation.y = index * 1.3;
        palmGroup.rotation.z = ((index % 3) - 1) * 0.08;
        palmGroup.scale.setScalar(0.85 + (index % 4) * 0.08);

        const trunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMat);
        trunk.castShadow = true;
        palmGroup.add(trunk);

        for (let i = 0; i < 7; i++) {
            const frond = new THREE.Mesh(frondGeo, frondMat);
            frond.position.y = 1.5;
            frond.rotation.set(0, (i / 7) * Math.PI * 2, -0.45);
            frond.castShadow = true;
            palmGroup.add(frond);
        }

        scene.add(palmGroup);
    });

    return { disposables };
}

export function CampusMap({
    points,
    activeId,
    onPointClick,
    onMapClick,
    previewPoint,
    className,
}: {
    points: CampusMapPoint[];
    activeId?: number | null;
    onPointClick?: (point: CampusMapPoint) => void;
    onMapClick?: (coords: { x: number; y: number }) => void;
    previewPoint?: { x: number; y: number } | null;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pinRefs = useRef(new Map<number, HTMLButtonElement>());
    const previewRef = useRef<HTMLDivElement | null>(null);

    // Kept in refs so the render loop and event listeners (set up once)
    // always see the latest props without tearing down the WebGL scene.
    const pointsRef = useRef(points);
    const previewPointRef = useRef(previewPoint);
    const onPointClickRef = useRef(onPointClick);
    const onMapClickRef = useRef(onMapClick);

    useEffect(() => {
        pointsRef.current = points;
    }, [points]);

    useEffect(() => {
        previewPointRef.current = previewPoint;
    }, [previewPoint]);

    useEffect(() => {
        onPointClickRef.current = onPointClick;
    }, [onPointClick]);

    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        // Viewed from the main gate side, like the printed map.
        camera.position.set(0, 13, 13);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.6, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 6;
        controls.maxDistance = 24;
        controls.maxPolarAngle = Math.PI / 2 - 0.04;

        const { disposables } = buildScene(scene);
        const raycaster = new THREE.Raycaster();

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

        const project = (x: number, y: number) => {
            const { x: wx, z: wz } = percentToWorld(x, y);
            const vector = new THREE.Vector3(wx, 0, wz).project(camera);

            return {
                visible: vector.z < 1,
                left: (vector.x * 0.5 + 0.5) * container.clientWidth,
                top: (-vector.y * 0.5 + 0.5) * container.clientHeight,
            };
        };

        function positionPin(
            el: HTMLElement | null | undefined,
            x: number,
            y: number,
        ) {
            if (!el) {
                return;
            }

            const { visible, left, top } = project(x, y);
            el.style.display = visible ? '' : 'none';
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
        }

        let raf = 0;
        function animate() {
            controls.update();

            for (const point of pointsRef.current) {
                positionPin(pinRefs.current.get(point.id), point.x, point.y);
            }

            const preview = previewPointRef.current;

            if (preview) {
                positionPin(previewRef.current, preview.x, preview.y);
            }

            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
        }
        animate();

        // Click-to-place: distinguish a tap from an orbit drag by movement
        // distance, then raycast onto the ground plane for the tapped spot.
        let downPos: { x: number; y: number } | null = null;

        function handlePointerDown(e: PointerEvent) {
            downPos = { x: e.clientX, y: e.clientY };
        }

        function handlePointerUp(e: PointerEvent) {
            if (!onMapClickRef.current || !downPos) {
                downPos = null;

                return;
            }

            const dx = e.clientX - downPos.x;
            const dy = e.clientY - downPos.y;
            downPos = null;

            if (Math.hypot(dx, dy) > 6) {
                return;
            }

            const rect = renderer.domElement.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1,
            );
            raycaster.setFromCamera(ndc, camera);
            // Hit buildings as well as the ground, so tapping a roof picks
            // that building rather than the ground behind it.
            const hit = raycaster
                .intersectObjects(scene.children, true)
                .find((h) => h.object instanceof THREE.Mesh);

            if (!hit) {
                return;
            }

            const coords = worldToPercent(hit.point.x, hit.point.z);
            onMapClickRef.current({
                x: Math.round(coords.x * 10) / 10,
                y: Math.round(coords.y * 10) / 10,
            });
        }

        renderer.domElement.addEventListener('pointerdown', handlePointerDown);
        renderer.domElement.addEventListener('pointerup', handlePointerUp);

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener(
                'pointerdown',
                handlePointerDown,
            );
            renderer.domElement.removeEventListener(
                'pointerup',
                handlePointerUp,
            );
            controls.dispose();
            renderer.dispose();
            disposables.forEach((d) => d.dispose());
            container.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            className={cn(
                'relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-sidebar-border/70 bg-sky-50 select-none dark:border-sidebar-border dark:bg-slate-950',
                // Pin placement (admin) passes previewPoint; plain taps don't.
                onMapClick &&
                    (previewPoint !== undefined
                        ? 'cursor-crosshair'
                        : 'cursor-pointer'),
                className,
            )}
        >
            <div ref={containerRef} className="absolute inset-0" />

            {points.map((point) => (
                <button
                    key={point.id}
                    type="button"
                    ref={(el) => {
                        if (el) {
                            pinRefs.current.set(point.id, el);
                        } else {
                            pinRefs.current.delete(point.id);
                        }
                    }}
                    style={{ display: 'none' }}
                    className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPointClick?.(point);
                    }}
                >
                    <MapPin
                        className={cn(
                            'size-7 fill-red-500 text-red-700 drop-shadow-sm transition-transform hover:scale-110',
                            activeId === point.id && 'scale-125',
                        )}
                    />
                    <span className="sr-only">{point.name}</span>
                </button>
            ))}

            {previewPoint && (
                <div
                    ref={previewRef}
                    style={{ display: 'none' }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-full animate-bounce"
                >
                    <MapPin className="size-7 fill-emerald-400 text-emerald-600 drop-shadow-sm" />
                </div>
            )}
        </div>
    );
}
