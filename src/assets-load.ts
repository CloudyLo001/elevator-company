import * as THREE from "three";
import { createMintGltfLoader } from "./assets/gltf-runtime";
import { MODEL_URLS } from "./asset-manifest";

/**
 * Per-asset normalization: generated GLBs arrive at arbitrary scale and
 * facing. Uniform-fit each to app dimensions, sit it on y=0, and apply a
 * hand-tuned yaw so openings face the camera axis (+z = toward cab rear).
 */
interface NormalizeRule {
  /** Fit the model's height to this value (uniform scale). */
  height?: number;
  /** Fit the model's width to this value instead (uniform scale). */
  width?: number;
  /** Non-uniform stretch to exactly this box (doors only). */
  exact?: [number, number, number];
  /** Extra yaw after normalization (radians). */
  rotY?: number;
  /**
   * Drop the model by this much after it is seated on y=0, to bury a base
   * plinth the generator added underneath the figure.
   */
  sink?: number;
}

const RULES: Record<string, NormalizeRule> = {
  "elevator-cab": { height: 2.75, rotY: Math.PI },
  "door-panel": { exact: [1.2, 2.62, 0.07] },
  // Uniform: a castle keep's proportions are the point, so it is fitted by
  // height and left to be as broad as it naturally is.
  tower: { height: 200 },
  "passenger-bellhop": { height: 1.68 },
  "passenger-guest": { height: 1.7 },
  "passenger-worker-a": { height: 1.74 },
  "passenger-worker-b": { height: 1.66 },
  // Sinks the octagonal display plinth the generator put under him and the
  // dog, so the pair stand on the floor rather than on a base.
  "passenger-resident": { height: 1.62, sink: 0.063 },
  "passenger-server": { height: 1.68 },
  "passenger-evening": { height: 1.72 },
  foyer: { width: 11, rotY: 0 },
  // Rooms are wider than the sightline through the doorway, so their side
  // walls fall outside the frame and each floor reads as part of a real
  // building rather than a shallow box seen end to end.
  "diorama-hotel": { width: 8.8, rotY: 0 },
  "diorama-office": { width: 8.8, rotY: 0 },
  "diorama-apartment": { width: 8.8, rotY: 0 },
  "diorama-restaurant": { width: 8.8, rotY: 0 },
  "diorama-penthouse": { width: 8.8, rotY: 0 },
};

export type AssetMap = Map<string, THREE.Group>;

/**
 * Bounds that also work for rigged characters. A SkinnedMesh's geometry
 * bounding box is authored in bind space and comes out degenerate here, which
 * would leave passengers mis-scaled and floating above the floor.
 */
function measure(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  let skinned = false;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinned = true;
    mesh.computeBoundingBox();
    if (mesh.boundingBox) {
      box.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
  });
  if (!skinned || box.isEmpty()) box.setFromObject(root);
  return box;
}

function normalize(root: THREE.Group, rule: NormalizeRule): THREE.Group {
  const wrapper = new THREE.Group();

  const box = measure(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  if (rule.exact) {
    root.scale.set(
      rule.exact[0] / Math.max(size.x, 1e-6),
      rule.exact[1] / Math.max(size.y, 1e-6),
      rule.exact[2] / Math.max(size.z, 1e-6),
    );
  } else if (rule.height !== undefined) {
    const s = rule.height / Math.max(size.y, 1e-6);
    root.scale.setScalar(s);
  } else if (rule.width !== undefined) {
    const s = rule.width / Math.max(size.x, 1e-6);
    root.scale.setScalar(s);
  }

  // Recompute bounds post-scale, then sit on y=0 centered at x/z origin.
  const box2 = measure(root);
  const c2 = new THREE.Vector3();
  box2.getCenter(c2);
  root.position.x -= c2.x;
  root.position.z -= c2.z;
  root.position.y -= box2.min.y + (rule.sink ?? 0);

  wrapper.add(root);
  if (rule.rotY) wrapper.rotation.y = rule.rotY;

  wrapper.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  return wrapper;
}

export async function loadAssets(
  onProgress: (loaded: number, total: number) => void,
): Promise<AssetMap> {
  const manager = new THREE.LoadingManager();
  const loader = createMintGltfLoader({ manager });
  const keys = Object.keys(MODEL_URLS);

  let fatal: Error | null = null;
  manager.onProgress = (_url, loaded, total) => {
    if (!fatal) onProgress(loaded, total);
  };
  const fail = (err: unknown) => {
    // Latch the first fatal error; later progress must not mask it.
    if (!fatal) fatal = err instanceof Error ? err : new Error(String(err));
  };

  const models: AssetMap = new Map();
  await Promise.all(
    keys.map(async (key) => {
      try {
        const gltf = await loader.loadAsync(MODEL_URLS[key]);
        models.set(key, normalize(gltf.scene, RULES[key] ?? {}));
      } catch (err) {
        fail(err);
      }
    }),
  );
  if (fatal) throw fatal;
  return models;
}
