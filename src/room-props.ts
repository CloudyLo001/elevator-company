/**
 * Hand-built set dressing for the generated rooms.
 *
 * The generated rooms are each a single mesh sharing one material, so nothing
 * inside them can be recoloured or replaced on its own. Anything that needs to
 * read differently has to be built and laid over the top — which is also how
 * the ground floor already gets its clean oak floor.
 *
 * Everything here is authored in holder-local space: the holder sits at
 * (0, storyY, DIORAMA_Z), so local z is world z + 1.4.
 *
 * Lighting is a single flat ambient (see flat-look.ts), so "lit" fittings are
 * MeshBasicMaterial — unlit, and therefore rendered at their full colour
 * regardless of the scene. That reads as a lamp being on without reintroducing
 * any of the glow that was deliberately removed.
 */

import * as THREE from "three";

// Same tones as the rest of the page, just opaque.
const CREAM = 0xe4dfd2;
const UPHOLSTERY = 0xd8d2c4;
const BRASS = 0xc9a86a;
const WALNUT = 0x4a3b2e;
const INK = 0x33322d;
const MARBLE = 0xcfcabd;
const LAMP_ON = 0xfff2d4;
const LEAF_A = 0x5f7d4f;
const LEAF_B = 0x496b3d;

const matte = (color: number, roughness = 1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0 });

/** Unlit, so it reads as a fitting that is switched on. */
const lit = (color = LAMP_ON) => new THREE.MeshBasicMaterial({ color });

function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

function cyl(
  parent: THREE.Object3D,
  mat: THREE.Material,
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  seg = 12,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * A potted plant with actual foliage — a ring of tapered blades fanning up and
 * out — rather than a flat green smear.
 */
function plant(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1,
): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);

  const potMat = matte(MARBLE, 0.95);
  cyl(g, potMat, 0.26, 0.19, 0.42, 0, 0.21, 0);
  cyl(g, matte(0x3b342b), 0.24, 0.24, 0.05, 0, 0.42, 0);

  const leafA = matte(LEAF_A, 0.9);
  const leafB = matte(LEAF_B, 0.9);
  const BLADES = 14;
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * Math.PI * 2 + (i % 2) * 0.22;
    const len = 0.62 + ((i * 37) % 11) / 11 * 0.55;
    const tilt = 0.42 + ((i * 53) % 7) / 7 * 0.5;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, len, 0.02),
      i % 2 ? leafA : leafB,
    );
    // Stand the blade on the soil, lean it outward, then swing it around.
    blade.position.set(0, 0.44 + (Math.cos(tilt) * len) / 2, 0);
    blade.rotation.set(0, 0, 0);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.44, 0);
    pivot.rotation.y = a;
    pivot.rotation.z = tilt;
    blade.position.set(0, len / 2, 0);
    pivot.add(blade);
    g.add(pivot);
  }
}

/** Floor lamp with a shade that is switched on. */
function floorLamp(parent: THREE.Object3D, x: number, y: number, z: number): void {
  const brass = matte(BRASS, 0.6);
  cyl(parent, brass, 0.16, 0.19, 0.04, x, y + 0.02, z);
  cyl(parent, brass, 0.025, 0.025, 1.5, x, y + 0.77, z, 8);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.29, 0.34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: LAMP_ON, side: THREE.DoubleSide }),
  );
  shade.position.set(x, y + 1.66, z);
  parent.add(shade);
  // Caps the top so the shade does not read as an open tube from above.
  cyl(parent, lit(), 0.2, 0.2, 0.02, x, y + 1.82, z, 16);
}

/** Multi-arm chandelier, hung from the ceiling. */
function chandelier(
  parent: THREE.Object3D,
  x: number,
  ceilY: number,
  z: number,
): void {
  const brass = matte(BRASS, 0.55);
  const drop = 0.62;
  cyl(parent, brass, 0.03, 0.03, drop, x, ceilY - drop / 2, z, 8);
  cyl(parent, brass, 0.14, 0.1, 0.09, x, ceilY - drop - 0.04, z);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.022, 8, 28), brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, ceilY - drop - 0.3, z);
  parent.add(ring);

  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, 22), brass);
  inner.rotation.x = Math.PI / 2;
  inner.position.set(x, ceilY - drop - 0.02, z);
  parent.add(inner);

  const ARMS = 8;
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2;
    const px = x + Math.cos(a) * 0.52;
    const pz = z + Math.sin(a) * 0.52;
    cyl(parent, brass, 0.02, 0.02, 0.2, px, ceilY - drop - 0.19, pz, 6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), lit());
    bulb.position.set(px, ceilY - drop - 0.05, pz);
    parent.add(bulb);
  }
}

/** A wide, low sofa with proper arms and cushions. */
function sofa(parent: THREE.Object3D, x: number, y: number, z: number, ry = 0): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);

  const body = matte(UPHOLSTERY, 0.95);
  const legs = matte(BRASS, 0.5);

  box(g, body, 2.5, 0.3, 0.95, 0, 0.42, 0);
  box(g, body, 2.5, 0.62, 0.22, 0, 0.79, -0.37);
  box(g, body, 0.24, 0.52, 0.95, -1.13, 0.68, 0);
  box(g, body, 0.24, 0.52, 0.95, 1.13, 0.68, 0);
  for (const cx of [-0.56, 0.56]) box(g, matte(CREAM, 0.95), 1.06, 0.16, 0.82, cx, 0.63, 0.03);
  for (const [lx, lz] of [[-1.05, 0.38], [1.05, 0.38], [-1.05, -0.38], [1.05, -0.38]])
    cyl(g, legs, 0.035, 0.035, 0.28, lx, 0.14, lz, 8);
}

function armchair(parent: THREE.Object3D, x: number, y: number, z: number, ry: number): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  const body = matte(UPHOLSTERY, 0.95);
  box(g, body, 0.92, 0.28, 0.86, 0, 0.44, 0);
  box(g, body, 0.92, 0.58, 0.2, 0, 0.78, -0.33);
  box(g, body, 0.18, 0.44, 0.86, -0.37, 0.66, 0);
  box(g, body, 0.18, 0.44, 0.86, 0.37, 0.66, 0);
  box(g, matte(CREAM, 0.95), 0.7, 0.14, 0.72, 0, 0.63, 0.02);
  for (const [lx, lz] of [[-0.34, 0.32], [0.34, 0.32], [-0.34, -0.32], [0.34, -0.32]])
    cyl(g, matte(BRASS, 0.5), 0.03, 0.03, 0.3, lx, 0.15, lz, 8);
}

/**
 * Floor 12 — the monitors and the shelving read as white-on-white against the
 * office's pale walls, so their shapes are unreadable. Lay dark screens and a
 * dark shelf face over them so the objects have an edge.
 */
export function addOfficeProps(holder: THREE.Group, floorY: number): void {
  const DESK_TOP = floorY + 0.92;
  const screen = matte(INK, 0.85);
  const brass = matte(BRASS, 0.55);

  // Two monitors on the desk. Local z = world z + 1.4.
  for (const mx of [-0.62, 0.34]) {
    const z = -1.72;
    cyl(holder, brass, 0.11, 0.13, 0.02, mx, DESK_TOP + 0.01, z, 12);
    cyl(holder, brass, 0.022, 0.022, 0.2, mx, DESK_TOP + 0.11, z, 8);
    const panel = box(holder, screen, 0.56, 0.36, 0.025, mx, DESK_TOP + 0.39, z);
    panel.rotation.x = -0.07;
    // A thin lit strip so the screens read as switched on, not as slabs.
    const glow = box(holder, lit(0xdfe8ee), 0.5, 0.3, 0.01, mx, DESK_TOP + 0.39, z + 0.02);
    glow.rotation.x = -0.07;
  }

  // Keyboards, so the desk surface is not bare under the screens.
  for (const kx of [-0.62, 0.34])
    box(holder, matte(0x8f938f, 0.9), 0.44, 0.02, 0.16, kx, DESK_TOP + 0.02, -1.34);
}

/**
 * Floor 60 — dressed up for the penthouse it is meant to be. The generated
 * room is dark and sparse, and its planting renders as a flat green streak, so
 * this lays a lit chandelier, seating, tables, lamps and real foliage over it.
 */
export function addPenthouseProps(
  holder: THREE.Group,
  floorY: number,
  ceilY: number,
): void {
  // Line the room in a pale tone. The generated room's walls are dark in its
  // own texture, and a material tint can only multiply — it darkens, never
  // brightens — so the only way to lift them is to lay lighter surfaces over
  // the top. Everything else in here sits in front of these.
  const wallMat = matte(0xcfc9bb, 1);
  // The generated room's back wall measures at world z -5.90, which is local
  // -4.50 here. This has to sit in front of it, not behind — at -4.58 it was
  // occluded by the very wall it was meant to cover.
  const BACK_Z = -4.45;
  box(holder, wallMat, 11.0, ceilY - floorY, 0.08, 0, (floorY + ceilY) / 2, BACK_Z);
  for (const sx of [-5.36, 5.36])
    box(holder, wallMat, 0.08, ceilY - floorY, 3.2, sx, (floorY + ceilY) / 2, -3.0);
  box(holder, matte(0xd6d1c4, 1), 11.0, 0.08, 3.2, 0, ceilY, -3.0);

  // Rug, to anchor the seating and lift the floor tone.
  const rug = box(holder, matte(CREAM, 1), 4.6, 0.02, 3.2, 0, floorY + 0.012, -2.6);
  rug.receiveShadow = true;
  box(holder, matte(BRASS, 0.8), 4.9, 0.008, 3.5, 0, floorY + 0.008, -2.6);

  chandelier(holder, 0, ceilY, -2.5);

  // Seating group, kept to the sides and back so it never crowds the doorway
  // or the space the passengers walk through.
  sofa(holder, -2.95, floorY, -3.5, Math.PI / 2.1);
  armchair(holder, 2.85, floorY, -3.15, -Math.PI / 2.2);
  armchair(holder, 2.6, floorY, -4.4, -Math.PI / 1.7);

  // Marble coffee table.
  box(holder, matte(MARBLE, 0.7), 1.15, 0.07, 0.68, -1.5, floorY + 0.42, -3.6);
  for (const [lx, lz] of [[-1.95, -3.35], [-1.05, -3.35], [-1.95, -3.85], [-1.05, -3.85]])
    cyl(holder, matte(BRASS, 0.5), 0.028, 0.028, 0.42, lx, floorY + 0.21, lz, 8);

  // Console against the back wall with a pair of lit table lamps.
  const CONSOLE_Z = -4.22;
  box(holder, matte(WALNUT, 0.85), 2.6, 0.07, 0.42, 0, floorY + 0.78, CONSOLE_Z);
  for (const lx of [-1.15, 1.15])
    cyl(holder, matte(WALNUT, 0.85), 0.05, 0.05, 0.78, lx, floorY + 0.39, CONSOLE_Z, 8);
  for (const lx of [-0.85, 0.85]) {
    cyl(holder, matte(BRASS, 0.55), 0.05, 0.09, 0.26, lx, floorY + 0.94, CONSOLE_Z, 10);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.18, 0.22, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: LAMP_ON, side: THREE.DoubleSide }),
    );
    shade.position.set(lx, floorY + 1.19, CONSOLE_Z);
    holder.add(shade);
  }
  // A framed panel over the console, so the back wall is not a blank field.
  box(holder, matte(BRASS, 0.6), 2.0, 1.05, 0.03, 0, floorY + 1.95, BACK_Z + 0.06);
  box(holder, matte(0xbfc4c0, 0.95), 1.86, 0.91, 0.02, 0, floorY + 1.95, BACK_Z + 0.09);

  floorLamp(holder, -4.15, floorY, -2.15);
  floorLamp(holder, 4.15, floorY, -3.9);

  // Real foliage, all of it kept in front of the new back wall. The larger one
  // stands where the generated room's own planting renders as a flat streak,
  // so that is what reads as the plant instead.
  plant(holder, 2.05, floorY, -4.3, 1.4);
  plant(holder, 3.85, floorY, -4.25, 1.05);
  plant(holder, -4.5, floorY, -4.3, 1.15);
}
