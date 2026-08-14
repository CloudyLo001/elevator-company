# ELEVATE — Scroll-Driven Elevator Landing Page

Use **mint-threejs-skills** (threejs-app-director route) and the **Mint MCP** to build this Three.js experience from scratch in this folder.

## App type and user goal

A cinematic, scroll-driven landing page for **Elevate**, a premium elevator company. The visitor never scrolls a webpage — scrolling rides an elevator upward through a skyscraper. Each "section" is a floor that demonstrates one Elevate product line. The goal: make the visitor feel the product by living inside it for sixty floors.

## Primary 3D subject

A beautifully detailed elevator cab, seen from inside, perfectly centered and symmetrical at all times. Around it: a skyscraper of floor dioramas, a rotating cast of passengers, and a roof finale where the camera pulls outside to reveal the full tower.

## Narrative flow (scroll timeline)

1. **Opening (scroll 0).** The page loads inside the elevator at the ground floor, doors open, looking outward at a serene entrance vestibule. Elevate wordmark + tagline overlaid, Wes Anderson-centered.
2. **First scroll.** The doors slide shut. The cab hums to life; floor indicator begins counting. Scrolling now maps directly to vertical travel — cables, counterweight shadows, and passing floor slabs visible through the cab's rear window strip sell the motion.
3. **Floor 1 — Hotel lobby.** Doors open on a warm hotel lobby diorama. Two guests and a bellhop enter with luggage. Product beat: *Elevate Hospitality* — smooth ride quality, whisper-quiet traction. Doors close, continue.
4. **Floor 12 — Corporate office.** One passenger exits; two office workers enter mid-conversation. Cool, precise mood. Product beat: *Elevate Enterprise* — destination dispatch, peak-traffic intelligence.
5. **Floor 27 — Luxury apartments.** A resident with a dog steps in. Dusky, intimate mood. Product beat: *Elevate Residence* — private access, silent night mode.
6. **Floor 43 — Restaurant.** Warm lantern light, a server with a tray crosses the frame. Product beat: *Elevate Service* — freight-rated finish options, spotless cab materials.
7. **Floor 60 — Penthouse.** The last passenger exits into a dark, moonlit penthouse. The cab is empty for the first time — a quiet beat.
8. **Roof finale.** Doors open to open sky. The camera drifts out of the cab, pulls back and cranes down to reveal the enormous skyscraper just traveled — lit windows tracing every floor visited — with the closing CTA ("Rise with Elevate" + contact) composed beside the tower, TOWERS-poster style.

Passengers enter/exit at multiple intermediate moments so the cab always feels alive; travel between story floors takes real scroll distance with number flicker and passing-floor light sweeps.

## Essential interactions

- **Floor button panel.** The cab's physical button column is clickable; pressing a button lights it and smoothly auto-scrolls the ride to that floor.
- **Hold-doors button.** While doors are open on a floor, a `<|>` button pauses the scroll-driven close so the visitor can look around the diorama; releasing resumes.
- **Shaft X-ray toggle.** A UI toggle switches between the interior cab camera and an exterior cutaway view: the building goes translucent, revealing the cab, rails, cables, and counterweight moving through the shaft as you scroll. State is preserved when toggling back.
- **Clickable passengers.** Hovering a passenger gives a subtle highlight; clicking opens a small card: their name, destination floor, and a one-line story ("Mika — Floor 43. Late for a tasting menu."). Their destination is real: they exit at that floor.

## Camera/control model

- Locked, symmetrical one-point-perspective camera inside the cab (Wes Anderson framing); scroll drives elevator Y-position, never camera pitch/yaw.
- Subtle cab sway/settle easing on stops. Door opens/closes, passenger walk-ins, and the roof pull-out are scroll-scrubbed timelines (GSAP ScrollTrigger + Lenis or equivalent smooth-scroll mapping), fully reversible when scrolling back down.
- X-ray view swaps to a fixed exterior tracking camera that follows the cab vertically.

## Visual direction

- Minimal **solid-color Japanese style**: flat-shaded surfaces, restrained muted palettes, soft ambient light, warm glowing window/lantern accents — per the TOWERS / KAGE references (screenshots provided). No photorealism, no busy textures; forms read as clean color blocks with gentle gradients.
- The **cab is the constant**: one consistent refined interior (pale wood, brass button column, soft dome light) across the whole ride.
- **Each floor is its own mood**: hotel = warm cream/amber; office = cool sage/graphite; apartments = dusk mauve; restaurant = lantern red/charcoal (KAGE-adjacent); penthouse = deep indigo night; roof = starfield with paper-toned typography.
- Typography and overlay UI follow the TOWERS layout language: small tracked-out uppercase labels, thin underlines, a large serif/kanji-weight display moment per floor, floor number as an oversized frame element ("FLOOR / 12" like "FRAME / 365").

## Assets (Mint MCP)

- Generate all hero assets with Mint MCP as stylized, flat-shaded GLB models consistent with the palette: elevator cab interior (doors as separate movable meshes or separately generated door panels), button column, 6–8 low-poly stylized passengers (idle/walk poses or Mint animations), one compact diorama per floor (lobby, office, apartment corridor, restaurant, penthouse), skyscraper exterior for the finale, shaft components (rails, cables, counterweight) for the X-ray view.
- Resolve one Mint Project for this codebase, register every artifact in `mint-assets.json` via the skill's sync script, and load GLBs through the Draco-capable shared loader per `gltf-runtime-compatibility.md`.
- Procedural geometry is fine for simple fills (floor slabs, sky, particles) but never a competing version of a successfully generated subject.

## State or data sources

- Static site; all copy (floor stories, product beats, passenger bios) authored in a single typed content module. No backend, no audio.

## Target devices

- Desktop-first (this is a showcase). Must not break at laptop sizes; graceful "best viewed on desktop" handling below tablet width is acceptable for v1.

## Performance/deployment constraints

- Vite + TypeScript + vanilla Three.js. 60fps target on a mid-range laptop: merged/instanced diorama meshes, lazy-load floor dioramas ahead of arrival, dispose behind, compressed GLBs.
- Local dev preview only — no deployment in this pass.

## Required outcome

- Complete primary journey (load → doors close → all five floors → roof reveal → CTA) with loading and error behavior; loading screen styled as the elevator inspection certificate.
- All four interactions working with clear feedback.
- Mint MCP for production assets; `mint-assets.json` registry maintained.
- Build, browser, interaction, screenshot, and canvas verification per the skill's verification policy.
- Report controls, state ownership, changed files, evidence, and risks.
