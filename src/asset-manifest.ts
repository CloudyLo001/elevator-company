/**
 * Browser URLs for synchronized Mint assets.
 * Paths mirror mint-assets.json (public/ root maps to "/").
 * Regenerated whenever `sync-mint-assets.mjs` runs - keep keys stable.
 */

export interface ManifestEntry {
  url: string;
}

export const MODEL_URLS: Record<string, string> = {
  "elevator-cab": "/assets/mint/elevator-cab/original_glb.glb",
  // "door-panel" intentionally absent: two Mint door generations came back
  // with baked-on ornament and further regens are credit-blocked; a plain
  // procedural steel leaf stands in (see scene.ts).
  tower: "/assets/mint/tower/original_glb.glb",
  "passenger-bellhop": "/assets/mint/passenger-bellhop/original_glb.glb",
  "passenger-guest": "/assets/mint/passenger-guest/original_glb.glb",
  "passenger-worker-a": "/assets/mint/passenger-worker-a/original_glb.glb",
  "passenger-worker-b": "/assets/mint/passenger-worker-b/original_glb.glb",
  "passenger-resident": "/assets/mint/passenger-resident/original_glb.glb",
  "passenger-server": "/assets/mint/passenger-server/original_glb.glb",
  "passenger-evening": "/assets/mint/passenger-evening/original_glb.glb",
  // "landing" intentionally absent: the bright lobby-wall generation is
  // blocked on Mint billing; a placeholder wall renders until it lands.
  "diorama-hotel": "/assets/mint/diorama-hotel/original_glb.glb",
  "diorama-office": "/assets/mint/diorama-office/original_glb.glb",
  "diorama-apartment": "/assets/mint/diorama-apartment/original_glb.glb",
  "diorama-restaurant": "/assets/mint/diorama-restaurant/original_glb.glb",
  "diorama-penthouse": "/assets/mint/diorama-penthouse/original_glb.glb",
};
