import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import Lenis from "lenis";
import type { World } from "./scene";
import { STOPS, ROOF_STORY, storyY, type PassengerDef } from "./content";
import { evaluate, progressForStopDwell, type RideState } from "./timeline";
import { updatePassengers, passengerByKey } from "./passengers";
import { Overlay } from "./overlay";
import { DOOR_CLOSED_X, DOOR_OPEN_X, drawLandingIndicator } from "./scene";

const ROOF_Y = storyY(ROOF_STORY);
const FINALE_LOOK_END = new THREE.Vector3(14, 118, 0);
/** Ground covered by one full walk cycle, used to sync stride to movement. */
const STRIDE_METRES = 1.45;

type ViewMode = "front" | "third" | "cctv" | "shaft";

function smoothstep(u: number): number {
  const c = THREE.MathUtils.clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
}

export class App {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private overlay = new Overlay();
  private lenis: Lenis;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerPx = { x: 0, y: 0 };
  private hoverButton: THREE.Mesh | null = null;
  private hoverPassenger: string | null = null;
  private pressedStory: number | null = null;
  private viewMode: ViewMode = "third";
  private holding = false;
  private prevCabY = 0;
  private speed = 0;
  private clock = new THREE.Clock();
  private lastState: RideState | null = null;
  private pressingButtons = new Set<THREE.Mesh>();
  private doorsSmooth = 0;
  private indicatorLabel = "";
  private indicatorDir: -1 | 0 | 1 = 0;
  // Damped camera state, held in cab-relative space (see frame()).
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camFov = 44;
  private camReady = false;
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private skyfade: HTMLDivElement;
  private finaleCurve: THREE.CatmullRomCurve3;
  private cardOpenFor: string | null = null;

  // scratch
  private bg = new THREE.Color(0x494f4a);
  private ambientTarget = new THREE.Color();
  private glowTarget = new THREE.Color();

  constructor(
    private world: World,
    canvas: HTMLCanvasElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // Supersample low-DPI displays a bit so straight steel edges stay crisp.
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(
      44,
      innerWidth / innerHeight,
      0.05,
      900,
    );

    // Metals need an environment to reflect or they render near-black.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    world.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    world.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.finaleCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, ROOF_Y + 1.6, 0.9),
        new THREE.Vector3(0, ROOF_Y + 2.6, -7.5),
        new THREE.Vector3(30, ROOF_Y + 10, 70),
        new THREE.Vector3(120, 205, 265),
      ],
      false,
      "catmullrom",
      0.35,
    );

    this.skyfade = document.createElement("div");
    Object.assign(this.skyfade.style, {
      position: "fixed",
      inset: "0",
      background: "#232838",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "45",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.skyfade);

    this.lenis = new Lenis({
      duration: 1.6,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      syncTouch: true,
      touchMultiplier: 1.5,
    });

    this.bindEvents();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  // ------------------------------------------------------------------ events
  private bindEvents(): void {
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    addEventListener("pointermove", (e) => {
      this.pointer.set(
        (e.clientX / innerWidth) * 2 - 1,
        -(e.clientY / innerHeight) * 2 + 1,
      );
      this.pointerPx = { x: e.clientX, y: e.clientY };
    });

    addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a")) return;
      // Refresh picking from the click position itself so taps and
      // synthetic clicks work without a preceding pointermove.
      this.pointer.set(
        (e.clientX / innerWidth) * 2 - 1,
        -(e.clientY / innerHeight) * 2 + 1,
      );
      this.pointerPx = { x: e.clientX, y: e.clientY };
      if (this.lastState) this.pick(this.lastState);
      if (this.hoverButton) {
        const data = this.hoverButton.userData as {
          story?: number;
          button?: THREE.Mesh;
        };
        if (data.story !== undefined) {
          this.travelTo(data.story);
        } else if (data.button) {
          // Dummy placeholder: depress briefly, do nothing.
          data.button.userData.pressedAt = performance.now();
          this.pressingButtons.add(data.button);
        }
        return;
      }
      if (this.hoverPassenger) {
        const def = passengerByKey(this.hoverPassenger);
        if (def) {
          this.cardOpenFor = def.key;
          this.overlay.showPassengerCard(def, this.pointerPx.x, this.pointerPx.y);
        }
        return;
      }
      this.cardOpenFor = null;
      this.overlay.hidePassengerCard();
    });

    const holdBtn = document.getElementById("hold-doors")!;
    const startHold = () => {
      this.holding = true;
      this.lenis.stop();
      this.overlay.setHolding(true);
    };
    const endHold = () => {
      if (!this.holding) return;
      this.holding = false;
      this.lenis.start();
      this.overlay.setHolding(false);
    };
    holdBtn.addEventListener("pointerdown", startHold);
    addEventListener("pointerup", endHold);
    addEventListener("pointercancel", endHold);

    const viewToggle = document.getElementById("view-toggle")!;
    const viewMenu = document.getElementById("view-menu")!;
    const viewLabel = document.getElementById("view-label")!;
    viewToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      viewMenu.classList.toggle("open");
    });
    const items = [...viewMenu.querySelectorAll<HTMLButtonElement>("[data-view]")];
    for (const item of items) {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.viewMode = item.dataset.view as ViewMode;
        viewLabel.textContent = item.dataset.label ?? "";
        for (const b of items) b.classList.toggle("active", b === item);
        viewMenu.classList.remove("open");
      });
    }
    addEventListener("click", () => viewMenu.classList.remove("open"));
  }

  private travelTo(story: number): void {
    this.pressedStory = story;
    this.cardOpenFor = null;
    this.overlay.hidePassengerCard();
    const max = document.body.scrollHeight - innerHeight;
    const target = progressForStopDwell(story) * max;
    const distance = Math.abs(target - this.lenis.scroll);
    this.lenis.scrollTo(target, {
      duration: Math.min(8, 1.6 + distance / 2400),
      easing: (u: number) =>
        u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
      lock: true,
    });
  }

  // ------------------------------------------------------------------- frame
  private frame(timeMs: number): void {
    this.lenis.raf(timeMs);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const max = Math.max(1, document.body.scrollHeight - innerHeight);
    const p = THREE.MathUtils.clamp(this.lenis.scroll / max, 0, 1);
    const state = evaluate(p);
    const w = this.world;

    // --- cab & doors ---
    const deltaY = state.cabY - this.prevCabY;
    this.speed = THREE.MathUtils.damp(
      this.speed,
      Math.abs(deltaY) / Math.max(dt, 1e-4),
      6,
      dt,
    );
    this.prevCabY = state.cabY;

    // Landing floor indicator tracks the car, like a real lobby display.
    const indLabel =
      state.finale > 0 || state.displayStory >= ROOF_STORY
        ? "R"
        : state.displayStory === 0
          ? "G"
          : String(state.displayStory);
    const indDir: -1 | 0 | 1 =
      deltaY > 0.002 ? 1 : deltaY < -0.002 ? -1 : 0;
    if (indLabel !== this.indicatorLabel || indDir !== this.indicatorDir) {
      this.indicatorLabel = indLabel;
      this.indicatorDir = indDir;
      drawLandingIndicator(w, indLabel, indDir);
    }
    const swayAmp = THREE.MathUtils.clamp(this.speed / 40, 0, 1) * 0.02;
    const sway = Math.sin(timeMs * 0.013) * swayAmp;
    w.cabGroup.position.y = state.cabY + sway;

    this.doorsSmooth = THREE.MathUtils.damp(
      this.doorsSmooth,
      state.doors,
      16,
      dt,
    );
    const doorX =
      DOOR_CLOSED_X + (DOOR_OPEN_X - DOOR_CLOSED_X) * this.doorsSmooth;
    w.doorL.position.x = -doorX;
    w.doorR.position.x = doorX;

    // --- shaft mechanics ---
    const cabTop = state.cabY + 2.8;
    const cableLen = Math.max(0.5, ROOF_Y + 4 - cabTop);
    w.cable.scale.y = cableLen;
    w.cable.position.set(0, cabTop + cableLen / 2, 0.6);
    w.counterweight.position.y = THREE.MathUtils.clamp(
      ROOF_Y - state.cabY,
      1,
      ROOF_Y - 1,
    );

    // --- passengers ---
    updatePassengers(state.t, state.cabY + sway, w.passengerRoots, {
      cabOffset: w.cabFloorOffset,
      storyTop: (story) => w.floorTops.get(story) ?? storyY(story),
    });

    // --- passenger locomotion ---
    // The stride is driven by distance walked rather than elapsed time, so
    // feet track the floor instead of sliding, and the cycle scrubs with the
    // scroll. Standing passengers hold a still pose rather than fidgeting.
    for (const [key, anim] of w.passengerAnims) {
      const root = w.passengerRoots.get(key);
      const walking = Boolean(root?.userData.walking);
      if (walking !== anim.walking) {
        anim.walking = walking;
        const [from, to] = walking
          ? [anim.idle, anim.walk]
          : [anim.walk, anim.idle];
        // Reset both base weights to 1 first: a fade multiplies the base
        // weight, so an action parked at 0 would never fade back in and the
        // character would snap to its bind pose.
        from.enabled = true;
        to.enabled = true;
        from.setEffectiveWeight(1);
        to.setEffectiveWeight(1);
        from.play();
        to.play();
        from.crossFadeTo(to, 0.26, false);
      }

      const walkClip = anim.walk.getClip();
      if (walking) {
        const walked = (root?.userData.walked as number) ?? 0;
        const cycles = walked / STRIDE_METRES;
        anim.walk.time =
          (((cycles + anim.phase) % 1) + 1) % 1 * walkClip.duration;
      }
      // Hold the idle clip on its opening frame: a neutral stance with no
      // head turning or weight shifting.
      anim.idle.time = 0;
      anim.mixer.update(dt);
    }

    // --- dummy button press animation ---
    if (this.pressingButtons.size) {
      const now = performance.now();
      for (const b of [...this.pressingButtons]) {
        const elapsed = now - (b.userData.pressedAt as number);
        if (elapsed >= 160) {
          b.position.z = b.userData.baseZ as number;
          this.pressingButtons.delete(b);
        } else {
          b.position.z =
            (b.userData.baseZ as number) -
            Math.sin((elapsed / 160) * Math.PI) * 0.009;
        }
      }
    }

    // --- diorama culling ---
    const shaftView = this.viewMode === "shaft";
    for (const [story, holder] of w.dioramas) {
      // Tight range: the foyer's generated walls are tall enough to poke up
      // into the floor above if its room is left visible while travelling.
      holder.visible = Math.abs(storyY(story) - state.cabY) < 2.5 || shaftView;
    }

    // --- mood ---
    const mood = STOPS[state.stopIndex].mood;
    const k = 1 - Math.exp(-dt * 3.2);
    this.bg.lerp(new THREE.Color(mood.sky), k);
    this.ambientTarget.set(mood.ambient);
    this.glowTarget.set(mood.glow);
    (w.scene.background as THREE.Color).copy(this.bg);
    if (w.scene.fog) (w.scene.fog as THREE.Fog).color.copy(this.bg);
    w.ambient.color.lerp(this.ambientTarget, k);
    w.cabLight.color.lerp(this.glowTarget, k * 0.6);

    const altitude = THREE.MathUtils.clamp(state.cabY / ROOF_Y, 0, 1);
    const starMat = w.stars.material as THREE.PointsMaterial;
    starMat.opacity = Math.max(altitude * 0.85, state.finale > 0 ? 0.95 : 0);
    (w.moon.material as THREE.MeshBasicMaterial).opacity = Math.max(
      (altitude - 0.55) * 2,
      state.finale > 0 ? 1 : 0,
    );

    // --- view modes & finale ---
    const finaleWorld = state.finale > 0.25;
    w.tower.visible = finaleWorld;
    w.shell.visible = shaftView && !finaleWorld && state.enter >= 1;
    w.shaft.visible = !finaleWorld;
    w.slabs.visible = !finaleWorld;
    w.roofDeck.visible = !finaleWorld;
    w.cabGroup.visible = !finaleWorld;
    for (const holder of w.dioramas.values()) {
      if (finaleWorld) holder.visible = false;
    }
    for (const root of w.passengerRoots.values()) {
      root.visible = !finaleWorld;
    }
    for (const light of w.dioramaLights.values()) {
      light.visible = !finaleWorld;
    }

    const tPos = this.targetPos;
    const tLook = this.targetLook;
    let tFov: number;

    if (state.finale > 0) {
      const u = state.finale;
      // sky flash masks the world swap at u≈0.25
      const flash = Math.max(0, 1 - Math.abs(u - 0.25) / 0.11);
      this.skyfade.style.opacity = String(flash * flash);

      this.finaleCurve.getPoint(THREE.MathUtils.clamp(u, 0, 1), tPos);
      tLook
        .set(0, ROOF_Y + 1.3, -5)
        .lerp(FINALE_LOOK_END, Math.min(1, u * 1.6));
      tFov = 44 + u * 6;
      if (w.scene.fog) {
        (w.scene.fog as THREE.Fog).near = 60;
        (w.scene.fog as THREE.Fog).far = 700;
      }
    } else {
      this.skyfade.style.opacity = "0";
      if (w.scene.fog) {
        (w.scene.fog as THREE.Fog).near = 26;
        (w.scene.fog as THREE.Fog).far = 110;
      }
      if (state.enter < 1) {
        // Boarding: cross the lobby toward the closed doors, then step in and
        // swing 180° into the active view. Pure function of scroll progress,
        // so the whole sequence scrubs cleanly in both directions.
        const view = this.viewCamera(
          this.viewMode === "shaft" ? "third" : this.viewMode,
          state,
          sway,
        );
        const a = smoothstep(state.approach);
        tPos.set(
          0,
          state.cabY + 1.66 - 0.14 * a,
          THREE.MathUtils.lerp(-9.6, -4.2, a),
        );
        const u = state.enter;
        const ease = smoothstep(u);
        tPos.lerp(view.pos, ease);

        const turn = THREE.MathUtils.clamp((u - 0.42) / 0.58, 0, 1);
        const turnEase = smoothstep(turn);
        const theta = Math.PI * turnEase;
        tLook.set(
          tPos.x + Math.sin(theta) * 3,
          state.cabY + 1.45,
          tPos.z + Math.cos(theta) * 3,
        );
        tLook.lerp(view.look, turnEase * turnEase);

        const introFov = 47 + 9 * a;
        tFov = introFov + (view.fov - introFov) * ease;
      } else {
        const view = this.viewCamera(this.viewMode, state, sway);
        tPos.copy(view.pos);
        tLook.copy(view.look);
        tFov = view.fov;
      }
    }

    // Damp the camera in cab-relative space: vertical travel stays locked to
    // the car (no lag while riding), while boarding, view switches and the
    // finale all ease instead of snapping.
    const baseY = state.cabY;
    if (!this.camReady) {
      this.camPos.set(tPos.x, tPos.y - baseY, tPos.z);
      this.camLook.set(tLook.x, tLook.y - baseY, tLook.z);
      this.camFov = tFov;
      this.camReady = true;
    }
    const lam = 13;
    this.camPos.set(
      THREE.MathUtils.damp(this.camPos.x, tPos.x, lam, dt),
      THREE.MathUtils.damp(this.camPos.y, tPos.y - baseY, lam, dt),
      THREE.MathUtils.damp(this.camPos.z, tPos.z, lam, dt),
    );
    this.camLook.set(
      THREE.MathUtils.damp(this.camLook.x, tLook.x, lam, dt),
      THREE.MathUtils.damp(this.camLook.y, tLook.y - baseY, lam, dt),
      THREE.MathUtils.damp(this.camLook.z, tLook.z, lam, dt),
    );
    this.camFov = THREE.MathUtils.damp(this.camFov, tFov, lam, dt);
    this.camera.position.set(this.camPos.x, this.camPos.y + baseY, this.camPos.z);
    this.camera.lookAt(this.camLook.x, this.camLook.y + baseY, this.camLook.z);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    // --- picking ---
    this.lastState = state;
    this.pick(state);

    // --- overlay / travel button state ---
    this.overlay.update(state);
    if (
      this.pressedStory !== null &&
      Math.abs(state.cabY - storyY(this.pressedStory)) < 0.05 &&
      state.doors > 0.8
    ) {
      this.litButton(null);
      this.pressedStory = null;
    }
    if (this.cardOpenFor) {
      // keep the card anchored while open
      const def = passengerByKey(this.cardOpenFor);
      if (!def || finaleWorld) {
        this.cardOpenFor = null;
        this.overlay.hidePassengerCard();
      }
    }

    this.renderer.render(w.scene, this.camera);
  }

  /** Camera placement for each labeled view; the intro blends into these. */
  private viewCamera(
    mode: ViewMode,
    state: RideState,
    sway: number,
  ): { pos: THREE.Vector3; look: THREE.Vector3; fov: number } {
    switch (mode) {
      case "shaft":
        return {
          pos: new THREE.Vector3(8.4, state.cabY + 2.2, 9.6),
          look: new THREE.Vector3(0, state.cabY + 1.1, 0),
          fov: 46,
        };
      case "front": {
        // Classic one-point perspective at eye level, dead centered.
        const eye = state.cabY + sway + 1.42;
        return {
          pos: new THREE.Vector3(0, eye, 0.82),
          look: new THREE.Vector3(0, eye, -4),
          fov: 58,
        };
      }
      case "cctv":
        // Corner-mounted security camera looking down across the cab.
        return {
          pos: new THREE.Vector3(-0.82, state.cabY + 2.12, 0.55),
          look: new THREE.Vector3(0.35, state.cabY + 0.7, -1.4),
          fov: 70,
        };
      default: {
        // Elevated third-person vantage from the cab's rear: high enough
        // to see over passengers' heads, tilted gently down, centered.
        const eye = state.cabY + sway + 2.08;
        return {
          pos: new THREE.Vector3(0, eye, 0.82),
          look: new THREE.Vector3(0, state.cabY + sway + 1.08, -4),
          fov: 60,
        };
      }
    }
  }

  // ------------------------------------------------------------------ picking
  private pick(state: RideState): void {
    const w = this.world;
    const interactive =
      this.viewMode !== "shaft" && state.finale === 0 && state.enter >= 1;
    let nextButton: THREE.Mesh | null = null;
    let nextPassenger: string | null = null;

    if (interactive) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const buttonHit = this.raycaster.intersectObjects(w.buttonHits, false)[0];
      if (buttonHit) {
        nextButton = buttonHit.object as THREE.Mesh;
      } else {
        const roots = [...w.passengerRoots.values()].filter((r) => r.visible);
        const hit = this.raycaster.intersectObjects(roots, true)[0];
        if (hit) {
          nextPassenger =
            (hit.object.userData.passengerKey as string | undefined) ?? null;
        }
      }
    }

    if (nextButton !== this.hoverButton) {
      this.hoverButton = nextButton;
      const label = nextButton
        ? (nextButton.userData as { label?: string }).label
        : undefined;
      if (label) {
        this.overlay.showButtonTip(label, this.pointerPx.x, this.pointerPx.y);
      } else {
        this.overlay.hideButtonTip();
      }
    }

    if (nextPassenger !== this.hoverPassenger) {
      this.setPassengerHighlight(this.hoverPassenger, false);
      this.hoverPassenger = nextPassenger;
      this.setPassengerHighlight(nextPassenger, true);
    }

    document.body.style.cursor =
      nextButton || nextPassenger ? "pointer" : "auto";

    if (this.pressedStory !== null) this.litButton(this.pressedStory);
  }

  private setPassengerHighlight(key: string | null, on: boolean): void {
    if (!key) return;
    const root = this.world.passengerRoots.get(key);
    if (!root) return;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.emissive !== undefined) {
          if (on) {
            std.userData.savedEmissive = std.emissive.getHex();
            std.emissive.offsetHSL(0, 0, 0.14);
          } else if (std.userData.savedEmissive !== undefined) {
            std.emissive.setHex(std.userData.savedEmissive);
            delete std.userData.savedEmissive;
          }
        }
      }
    });
  }

  private litButton(story: number | null): void {
    for (const hit of this.world.buttonHits) {
      const data = hit.userData as { story?: number; button?: THREE.Mesh };
      if (data.story === undefined || !data.button) continue;
      const mat = data.button.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity =
        story !== null && data.story === story ? 1.8 : 0.12;
    }
  }

  passengerDefs(): PassengerDef[] {
    return [...this.world.passengerRoots.keys()]
      .map((k) => passengerByKey(k))
      .filter((d): d is PassengerDef => Boolean(d));
  }
}
