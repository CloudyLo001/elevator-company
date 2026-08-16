/**
 * Assembles the finale tower: procedural geometry + procedural surfaces, sized
 * to the shaft it replaces and wired to the rising cut plane.
 */

import * as THREE from "three";
import { buildTenshu, TENSHU_HEIGHT, TENSHU_WIDTH } from "./tenshu";
import {
  surface,
  texBronze,
  texIshigaki,
  texPlaster,
  texRoofTile,
  texTimber,
} from "./textures";

export interface FinaleTower {
  group: THREE.Group;
  /** Every material clipped by the build plane, for the palette cross-fade. */
  materials: THREE.MeshStandardMaterial[];
  size: { height: number; width: number };
}

/**
 * Build the keep and scale it onto the shaft's envelope: `targetHeight` tall by
 * `targetWidth` across, so it stands in for the shaft on the same footprint and
 * builds in the same direction under the same clip plane.
 *
 * A keep is naturally about 2:1 and the shaft is about 30:1, so this is a hard
 * non-uniform stretch. Three's normal matrix keeps the lighting correct, but
 * the roof curves genuinely do elongate — that is inherent to fitting a castle
 * onto a needle, and it is the intended look here. The vertical UV repeats are
 * compensated by the stretch ratio below so the tile courses and grain at least
 * keep a sane aspect instead of smearing by the full 13x.
 */
export function buildFinaleTower(
  targetHeight: number,
  targetWidth: number,
  clip: THREE.Plane
): FinaleTower {
  const geos = buildTenshu();

  const sx = targetWidth / TENSHU_WIDTH;
  const sy = targetHeight / TENSHU_HEIGHT;
  // How much taller each surface is being pulled than it is being widened.
  const stretch = sy / sx;

  // One painted surface per material, each deriving its own bump and roughness.
  // V repeats carry the stretch so courses stay legible under the scale.
  const mats = {
    stone: surface(texIshigaki(), {
      repeat: [2, 3 * stretch],
      bump: 1.5,
      rough: [0.72, 0.98],
    }),
    plaster: surface(texPlaster(), {
      repeat: [2, 2 * stretch],
      bump: 0.7,
      rough: [0.6, 0.86],
    }),
    timber: surface(texTimber(), {
      repeat: [1, 2 * stretch],
      bump: 1.1,
      rough: [0.58, 0.9],
    }),
    tile: surface(texRoofTile(), {
      repeat: [1, 1 * stretch],
      bump: 1.3,
      rough: [0.4, 0.78],
    }),
    bronze: surface(texBronze(), {
      repeat: [1, 1 * stretch],
      bump: 0.9,
      rough: [0.28, 0.55],
      metalness: 0.85,
    }),
  };

  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];

  for (const key of Object.keys(mats) as (keyof typeof mats)[]) {
    const geo = geos[key];
    if (!geo) continue;
    const mat = mats[key];
    // The whole tower clips against the shared rising plane — this is what
    // makes it build from the ground up without animating a single member.
    mat.clippingPlanes = [clip];
    mat.clipShadows = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    materials.push(mat);
  }

  group.scale.set(sx, sy, sx);

  const box = new THREE.Box3().setFromObject(group);
  return {
    group,
    materials,
    size: {
      height: Math.max(1, box.max.y - box.min.y),
      width: Math.max(1, box.max.x - box.min.x),
    },
  };
}
