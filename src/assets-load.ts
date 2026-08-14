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
}

const RULES: Record<string, NormalizeRule> = {
  "elevator-cab": { height: 2.75, rotY: Math.PI },
  "door-panel": { exact: [1.2, 2.62, 0.07] },
  tower: { height: 256 },
  "passenger-bellhop": { height: 1.68 },
  "passenger-guest": { height: 1.7 },
  "passenger-worker-a": { height: 1.74 },
  "passenger-worker-b": { height: 1.66 },
  "passenger-resident": { height: 1.62 },
  "passenger-server": { height: 1.68 },
  "passenger-evening": { height: 1.72 },
  foyer: { width: 11, rotY: 0 },
  "diorama-hotel": { width: 4.4, rotY: 0 },
  "diorama-office": { width: 4.4, rotY: 0 },
  "diorama-apartment": { width: 4.4, rotY: 0 },
  "diorama-restaurant": { width: 4.4, rotY: 0 },
  "diorama-penthouse": { width: 4.4, rotY: 0 },
};

export type AssetMap = Map<string, THREE.Group>;

function normalize(root: THREE.Group, rule: NormalizeRule): THREE.Group {
  const wrapper = new THREE.Group();

  const box = new THREE.Box3().setFromObject(root);
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
  const box2 = new THREE.Box3().setFromObject(root);
  const c2 = new THREE.Vector3();
  box2.getCenter(c2);
  root.position.x -= c2.x;
  root.position.z -= c2.z;
  root.position.y -= box2.min.y;

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

  const assets: AssetMap = new Map();
  await Promise.all(
    keys.map(async (key) => {
      try {
        const gltf = await loader.loadAsync(MODEL_URLS[key]);
        assets.set(key, normalize(gltf.scene, RULES[key] ?? {}));
      } catch (err) {
        // Latch the first fatal error; later progress must not mask it.
        if (!fatal) {
          fatal = err instanceof Error ? err : new Error(String(err));
        }
      }
    }),
  );
  if (fatal) throw fatal;
  return assets;
}
