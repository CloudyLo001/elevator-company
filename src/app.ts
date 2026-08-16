import * as THREE from "three";
import Lenis from "lenis";
import type { World } from "./scene";
import { STOPS, ROOF_STORY, storyY, type PassengerDef } from "./content";
import { evaluate, progressForStopDwell, type RideState } from "./timeline";
import { updatePassengers, passengerByKey } from "./passengers";
import { Overlay } from "./overlay";
import { DOOR_CLOSED_X, DOOR_OPEN_X, drawLandingIndicator } from "./scene";
import { LAND_THEMES } from "./finale/landscape";
import { flattenLook } from "./flat-look";

const ROOF_Y = storyY(ROOF_STORY);
const FINALE_LOOK_END = new THREE.Vector3(0, 96, 0);
type TimeKey = "morning" | "noon" | "sunset" | "night";
type WeatherKey = "clear" | "rain" | "snow";

interface SkyPreset {
  sky: number;
  light: number;
  lightIntensity: number;
  hemi: number;
  hemiIntensity: number;
  stars: number;
}

/** Rooftop skies the finale can open out into. */
const TIMES: Record<TimeKey, SkyPreset> = {
  morning: {
    sky: 0xaecbe2,
    light: 0xffe3c4,
    lightIntensity: 1.7,
    hemi: 0xdfeaf2,
    hemiIntensity: 1.35,
    stars: 0,
  },
  noon: {
    sky: 0x8fbfe8,
    light: 0xffffff,
    lightIntensity: 2.1,
    hemi: 0xe9f1f8,
    hemiIntensity: 1.65,
    stars: 0,
  },
  sunset: {
    sky: 0xdb9a72,
    light: 0xffb173,
    lightIntensity: 1.6,
    hemi: 0xf0c4a4,
    hemiIntensity: 1.05,
    stars: 0.18,
  },
  night: {
    sky: 0x161d33,
    light: 0x8fa0c8,
    lightIntensity: 0.5,
    hemi: 0x2e3c58,
    hemiIntensity: 0.5,
    stars: 1,
  },
};

/** Seconds a full rebuild takes, matching the reference's pacing. */
const REBUILD_SECONDS = 4.5;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.65;

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
  /** Which land theme is currently painted, so the sky is only repainted on
   *  an actual change rather than every frame. */
  private landThemeKey: TimeKey | null = null;
  private cardOpenFor: string | null = null;

  // scratch
  private bg = new THREE.Color(0x494f4a);
  private skyTarget = new THREE.Color();
  private tintTarget = new THREE.Color();
  // Rooftop state: sky, weather, build progress and free-look camera.
  private timeKey: TimeKey = "noon";
  private weatherKey: WeatherKey = "clear";
  private rebuildStart: number | null = null;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private zoom = 1;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private atEnd = false;

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
    // Needed for the tower's rising build plane.
    this.renderer.localClippingEnabled = true;

    this.camera = new THREE.PerspectiveCamera(
      44,
      innerWidth / innerHeight,
      0.05,
      900,
    );

    // No environment map. Nothing is metallic or glossy any more, so there is
    // nothing left that needs something to reflect — and the environment was
    // itself a source of sheen on every smooth surface.
    world.scene.environment = null;

    // Tone mapping off. ACES compresses and desaturates highlights, which
    // fights "keep everything its own colour" under flat ambient light.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;

    flattenLook(world.scene, this.renderer);

    this.finaleCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, ROOF_Y + 1.6, 0.9),
        new THREE.Vector3(0, ROOF_Y + 2.6, -7.5),
        new THREE.Vector3(30, ROOF_Y + 10, 70),
        new THREE.Vector3(150, 152, 336),
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

    this.bindRooftopControls();
  }

  /** Swap the camera's depth range, only when it actually changes — every
   *  assignment costs a projection matrix rebuild. */
  private setCameraRange(near: number, far: number): void {
    if (this.camera.near === near && this.camera.far === far) return;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  /** Sky, weather, rebuild and free-look, all live only on the rooftop. */
  private bindRooftopControls(): void {
    const bar = document.getElementById("sky-bar")!;
    const setActive = (group: HTMLElement, chosen: Element) => {
      for (const b of group.querySelectorAll(".sky-opt")) {
        b.classList.toggle("active", b === chosen);
      }
    };
    for (const btn of bar.querySelectorAll<HTMLButtonElement>("[data-time]")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.timeKey = btn.dataset.time as TimeKey;
        setActive(btn.parentElement!, btn);
      });
    }
    for (const btn of bar.querySelectorAll<HTMLButtonElement>("[data-weather]")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.weatherKey = btn.dataset.weather as WeatherKey;
        setActive(btn.parentElement!, btn);
      });
    }
    document.getElementById("rebuild")!.addEventListener("click", (e) => {
      e.stopPropagation();
      this.rebuildStart = performance.now();
    });

    // Drag to orbit the tower.
    addEventListener("pointerdown", (e) => {
      if (!this.atEnd) return;
      if ((e.target as HTMLElement).closest("button, a, .sky-bar")) return;
      this.dragging = true;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
    });
    addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.orbitYaw -= (e.clientX - this.dragX) * 0.005;
      this.orbitPitch = THREE.MathUtils.clamp(
        this.orbitPitch + (e.clientY - this.dragY) * 0.0022,
        -0.5,
        0.85,
      );
      this.dragX = e.clientX;
      this.dragY = e.clientY;
    });
    for (const evt of ["pointerup", "pointercancel"]) {
      addEventListener(evt, () => {
        this.dragging = false;
      });
    }
    addEventListener("dblclick", () => {
      if (!this.atEnd) return;
      this.orbitYaw = 0;
      this.orbitPitch = 0;
      this.zoom = 1;
    });

    // Wheel zooms while out on the roof. Once fully zoomed out, further
    // scrolling up is handed back so the ride can be re-entered.
    addEventListener(
      "wheel",
      (e) => {
        if (!this.atEnd) return;
        if (e.deltaY < 0 && this.zoom >= ZOOM_MAX - 1e-3) return;
        e.preventDefault();
        e.stopPropagation();
        this.zoom = THREE.MathUtils.clamp(
          this.zoom + e.deltaY * 0.0012,
          ZOOM_MIN,
          ZOOM_MAX,
        );
      },
      { passive: false, capture: true },
    );
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
    // Stepping outside hands the sky over to the rooftop controls. The white
    // flash that hides the world swap also covers the changeover, and the
    // ride's own per-floor moods are left untouched.
    const dayBlend = smoothstep((state.finale - 0.18) / 0.22);
    const preset = TIMES[this.timeKey];
    const mood = STOPS[state.stopIndex].mood;
    const k = 1 - Math.exp(-dt * 3.2);

    this.skyTarget.set(mood.sky);
    if (dayBlend > 0) {
      this.tintTarget.set(preset.sky);
      // Rain drains the colour out of whatever sky is showing.
      if (this.weatherKey === "rain") {
        this.tintTarget.lerp(this.tintTarget.clone().offsetHSL(0, -0.4, -0.1), 0.75);
      }
      this.skyTarget.lerp(this.tintTarget, dayBlend);
    }
    this.bg.lerp(this.skyTarget, k);
    // The per-floor moods no longer touch the lights. Under a single neutral
    // ambient, tinting it would tint the entire world rather than one room, and
    // every surface is meant to read as its own colour. The moods still drive
    // the sky and fog below, which is where they now do their work.
    (w.scene.background as THREE.Color).copy(this.bg);
    if (w.scene.fog) (w.scene.fog as THREE.Fog).color.copy(this.bg);

    const altitude = THREE.MathUtils.clamp(state.cabY / ROOF_Y, 0, 1);
    const riding = Math.max(altitude * 0.85, state.finale > 0 ? 0.95 : 0);
    const starMat = w.stars.material as THREE.PointsMaterial;
    starMat.opacity = THREE.MathUtils.lerp(riding, preset.stars, dayBlend);
    (w.moon.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(
      Math.max((altitude - 0.55) * 2, state.finale > 0 ? 1 : 0),
      preset.stars,
      dayBlend,
    );

    // --- rooftop build, weather and free-look ---
    this.atEnd = state.finale > 0.62;
    document.getElementById("sky-bar")!.classList.toggle("available", this.atEnd);

    // The tower rises with the scroll, and REBUILD replays it on demand.
    let build = smoothstep((state.finale - 0.3) / 0.5);
    if (this.rebuildStart !== null) {
      const elapsed = (timeMs - this.rebuildStart) / (REBUILD_SECONDS * 1000);
      if (elapsed >= 1) this.rebuildStart = null;
      else build = Math.min(build, smoothstep(elapsed));
    }
    const towerTop = w.towerSize.height * 1.02;
    w.towerClip.constant = build * towerTop;
    const building = state.finale > 0.25 && build > 0.002 && build < 0.995;
    w.buildLine.visible = building;
    if (building) {
      const span = w.towerSize.width * 1.04;
      w.buildLine.position.set(0, build * towerTop, 0);
      w.buildLine.scale.set(span, 1, span);
      (w.buildLine.material as THREE.MeshBasicMaterial).opacity = 0.45;
    }

    const rainOn = this.weatherKey === "rain" ? dayBlend : 0;
    const snowOn = this.weatherKey === "snow" ? dayBlend : 0;
    w.rain.visible = rainOn > 0.01;
    w.snow.visible = snowOn > 0.01;
    (w.rain.material as THREE.LineBasicMaterial).opacity = 0.45 * rainOn;
    (w.snow.material as THREE.PointsMaterial).opacity = 0.9 * snowOn;
    if (w.rain.visible) this.fallRain(w.rain, dt);
    if (w.snow.visible) this.fallSnow(w.snow, dt);

    // --- view modes & finale ---
    const finaleWorld = state.finale > 0.25;
    w.tower.visible = finaleWorld;
    // The ground sits at y=0, exactly where the foyer is, so it must not exist
    // outside the finale.
    w.landscape.group.visible = finaleWorld;
    w.landscape.sky.visible = finaleWorld;
    if (finaleWorld) {
      w.landscape.update(dt);
      if (this.landThemeKey !== this.timeKey) {
        this.landThemeKey = this.timeKey;
        w.landscape.setTheme(LAND_THEMES[this.timeKey]);
      }
      // The land themes still drive the sky dome, fog and the terrain and grass
      // tints via setTheme above. Their sun and hemisphere are deliberately not
      // applied: the rooftop is lit by the same flat ambient as the rest of the
      // world now, so the tower and hills read as flat colour with no raking
      // light across them.
    }
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
      // Once the tower is out, the pointer leans the camera and dragging
      // orbits it, with the wheel pulling in and out.
      const parallax = smoothstep((u - 0.35) / 0.65);
      if (parallax > 0) {
        const yaw = this.orbitYaw + this.pointer.x * 0.2 * parallax;
        const lift =
          (this.orbitPitch + this.pointer.y * 0.12 * parallax) * 150;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const cx = tPos.x * cos - tPos.z * sin;
        const cz = tPos.x * sin + tPos.z * cos;
        const pivot = ROOF_Y * 0.45;
        tPos.set(
          cx * this.zoom,
          pivot + (tPos.y + lift - pivot) * this.zoom,
          cz * this.zoom,
        );
      }
      tLook
        .set(0, ROOF_Y + 1.3, -5)
        .lerp(FINALE_LOOK_END, Math.min(1, u * 1.6));
      tFov = 44 + u * 6;
      // The finale world is ~17x the size of the shaft, so it needs both its
      // own fog distances and a far plane that can reach the horizon. Near is
      // pulled forward too — nothing is close to the camera out here, and a
      // 0.05 near against a 20000 far would wreck depth precision.
      if (w.scene.fog) {
        const fog = w.scene.fog as THREE.Fog;
        fog.near = w.landscape.fogNear;
        fog.far = w.landscape.fogFar;
        fog.color.copy(w.landscape.fogColor);
      }
      (w.scene.background as THREE.Color).copy(w.landscape.fogColor);
      this.setCameraRange(1, 20000);
    } else {
      this.setCameraRange(0.05, 900);
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

  /** Advance falling rain, wrapping each streak back to the top. */
  private fallRain(rain: THREE.LineSegments, dt: number): void {
    const pos = rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const { speeds, height } = rain.userData as {
      speeds: Float32Array;
      height: number;
    };
    const arr = pos.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      const drop = speeds[i] * dt;
      arr[i * 6 + 1] -= drop;
      arr[i * 6 + 4] -= drop;
      if (arr[i * 6 + 4] < 0) {
        const len = arr[i * 6 + 1] - arr[i * 6 + 4];
        arr[i * 6 + 1] = height;
        arr[i * 6 + 4] = height - len;
      }
    }
    pos.needsUpdate = true;
  }

  /** Advance drifting snow, wrapping each flake back to the top. */
  private fallSnow(snow: THREE.Points, dt: number): void {
    const pos = snow.geometry.getAttribute("position") as THREE.BufferAttribute;
    const { speeds, drift, height } = snow.userData as {
      speeds: Float32Array;
      drift: Float32Array;
      height: number;
    };
    const arr = pos.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      arr[i * 3 + 1] -= speeds[i] * dt;
      drift[i] += dt * 0.8;
      arr[i * 3] += Math.sin(drift[i]) * dt * 2.2;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = height;
    }
    pos.needsUpdate = true;
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
