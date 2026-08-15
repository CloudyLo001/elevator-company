/**
 * Browser URLs for synchronized Mint assets.
 * Paths mirror mint-assets.json (public/ root maps to the deployment base).
 * Regenerated whenever `sync-mint-assets.mjs` runs - keep keys stable.
 */

/** Resolve a public-root path against the deployment base (GitHub Pages). */
function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`.replace(/([^:])\/{2,}/g, "$1/");
}

export const MODEL_URLS: Record<string, string> = {
  "elevator-cab": asset("assets/mint/elevator-cab/original_glb.glb"),
  // "door-panel" intentionally absent: two Mint door generations came back
  // with baked-on ornament, so a plain procedural steel leaf stands in
  // (see makeProceduralDoorLeaf in scene.ts).
  tower: asset("assets/mint/tower/original_glb.glb"),
  foyer: asset("assets/mint/foyer/original_glb.glb"),
  "passenger-bellhop": asset("assets/mint/passenger-bellhop/original_glb.glb"),
  "passenger-guest": asset("assets/mint/passenger-guest/original_glb.glb"),
  "passenger-worker-a": asset("assets/mint/passenger-worker-a/original_glb.glb"),
  "passenger-worker-b": asset("assets/mint/passenger-worker-b/original_glb.glb"),
  "passenger-resident": asset("assets/mint/passenger-resident/original_glb.glb"),
  "passenger-server": asset("assets/mint/passenger-server/original_glb.glb"),
  "passenger-evening": asset("assets/mint/passenger-evening/original_glb.glb"),
  "diorama-hotel": asset("assets/mint/diorama-hotel/original_glb.glb"),
  "diorama-office": asset("assets/mint/diorama-office/original_glb.glb"),
  "diorama-apartment": asset("assets/mint/diorama-apartment/original_glb.glb"),
  "diorama-restaurant": asset("assets/mint/diorama-restaurant/original_glb.glb"),
  "diorama-penthouse": asset("assets/mint/diorama-penthouse/original_glb.glb"),
};
