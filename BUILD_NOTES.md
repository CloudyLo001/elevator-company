# Elevate build notes (working doc)

Mint Project: `zd7a1p9yend4hjjcgsr5z346098cfbbv` — "Elevate Elevator Site"

## Generations in flight (started 2026-08-14)

| Key | Type | Asset ID | Chat |
| --- | --- | --- | --- |
| elevator-cab (v2, open doorway) | model | ks753yt2243b6bdkpjsmz428xd8cfd05 | https://mint.gg/chat/ph7b0wv8hmdqdvk25e8q6jhrn18cetsj |
| door-panel | model | ks78cqb2yjq8he3z38xnep63cx8cfntv | https://mint.gg/chat/ph77fe5rrb92zsj71mdhkvgya18cf3c0 |
| tower | model | ks7d57gn6ctwe6hm6fmks3347x8cf30s | https://mint.gg/chat/ph77e8h292yvdw9q2ygdx8dbp18cej33 |
| passengers | asset_pack (7) | th77ah824gpjt2vjpyfq1padks8ceyhz | https://mint.gg/chat/ph71srext9ddbpr1008j4yy70d8cej5h |
| dioramas | asset_pack (6) | th78f1et63vdhmk8mm6z66p8mn8cf0w6 | https://mint.gg/chat/ph76r1465r1hvyg64pkp37280d8cewbm |

## Pending / blocked (2026-08-14)

- `landing` bright marble lobby wall: preview ready, FINAL BLOCKED on Mint billing
  (needs 625 credits, 592 available). Asset ks76nrr4qpcjecc80467z0fnpn8cege8,
  chat https://mint.gg/chat/ph7f292n0bx1cqcs618bs9rm218cf4nh. Once credits are
  added: approve_final_generation → sync under key `landing` → restore the
  entry in src/asset-manifest.ts (placeholder wall in scene.ts takes over
  automatically when the asset is absent).
- `door-panel`: two generated leaves arrived with baked ornament (buttons,
  then swirls). Procedural placeholder leaf in scene.ts
  (makeProceduralDoorLeaf). Regenerate when credits allow, then restore the
  manifest entry.

## Steel redesign generations (2026-08-14, second pass)

| Key | Asset ID | Chat |
| --- | --- | --- |
| elevator-cab (steel v3) | ks7ekjcxvm4cj1fv9vhncb999x8ceb7t | https://mint.gg/chat/ph7b0wv8hmdqdvk25e8q6jhrn18cetsj |
| door-panel (steel v2) | ks75712g78ehqgk09nw2be1ecs8cfx3r | https://mint.gg/chat/ph77fe5rrb92zsj71mdhkvgya18cf3c0 |
| landing (new) | ks706g576nvbfq77nbqh5xecm18ce7ne | https://mint.gg/chat/ph7f292n0bx1cqcs618bs9rm218cf4nh |

Diorama pack item order: ground vestibule, hotel lobby, corporate office, apartment corridor, restaurant, penthouse.
Passenger pack item order: bellhop, hotel guest, office worker A, office worker B, resident with dog, restaurant server, penthouse guest.

## Pipeline reminders

- Sync via `node C:/Users/Asus/.claude/skills/mint-threejs-skills/scripts/sync-mint-assets.mjs --project . --manifest <tmp.json> --key <key>`
- Draco decoder path: https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/
- No procedural stand-ins for subjects still generating; procedural allowed for shaft rails/cables/counterweight, floor slabs, sky.
