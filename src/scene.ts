import * as THREE from "three";
import type { AssetMap } from "./assets-load";
import { BUTTON_FLOORS, PASSENGERS, STOPS, ROOF_STORY, storyY } from "./content";

export const DOOR_Z = -1.12;
export const DOOR_CLOSED_X = 0.6;
export const DOOR_OPEN_X = 1.78;
export const DIORAMA_Z = -1.4;
const TOWER_HEIGHT = 256;

export interface World {
  scene: THREE.Scene;
  cabGroup: THREE.Group;
  doorL: THREE.Group;
  doorR: THREE.Group;
  dioramas: Map<number, THREE.Group>;
  dioramaLights: Map<number, THREE.PointLight>;
  tower: THREE.Group;
  shell: THREE.Mesh;
  shaft: THREE.Group;
  counterweight: THREE.Mesh;
  cable: THREE.Mesh;
  slabs: THREE.InstancedMesh;
  stars: THREE.Points;
  moon: THREE.Mesh;
  roofDeck: THREE.Group;
  cabLight: THREE.PointLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  buttonHits: THREE.Mesh[];
  buttonPanel: THREE.Group;
  landingIndicator: THREE.Mesh | null;
  passengerRoots: Map<string, THREE.Group>;
}

/**
 * Stone floor tiles. Perspective convergence of the grout lines is what
 * actually makes a flat plane read as a floor.
 */
function makeFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#9d9a93";
  ctx.fillRect(0, 0, 512, 512);

  // Faint veining so each tile is not perfectly uniform.
  for (let i = 0; i < 700; i++) {
    const g = 150 + Math.random() * 45;
    ctx.fillStyle = `rgba(${g | 0}, ${(g - 3) | 0}, ${(g - 10) | 0}, 0.05)`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 512,
      Math.random() * 512,
      6 + Math.random() * 46,
      3 + Math.random() * 16,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Four tiles per texture tile, with a darker recessed grout joint.
  ctx.strokeStyle = "#7c7972";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.moveTo(1, 0);
  ctx.lineTo(1, 512);
  ctx.moveTo(0, 1);
  ctx.lineTo(512, 1);
  ctx.stroke();
  // Highlight along one side of each joint for a chamfered edge.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(261, 0);
  ctx.lineTo(261, 512);
  ctx.moveTo(0, 261);
  ctx.lineTo(512, 261);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Landing floor-indicator screen above the doors. */
export function drawLandingIndicator(
  world: World,
  label: string,
  dir: -1 | 0 | 1,
): void {
  const mesh = world.landingIndicator;
  if (!mesh) return;
  const canvas = mesh.userData.canvas as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0c0e0f";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#ffb257";
  if (dir !== 0) {
    const cy = 48;
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(58, cy - 22);
      ctx.lineTo(78, cy + 14);
      ctx.lineTo(38, cy + 14);
    } else {
      ctx.moveTo(58, cy + 22);
      ctx.lineTo(78, cy - 14);
      ctx.lineTo(38, cy - 14);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.font = "700 58px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, dir === 0 ? 128 : 152, 50);
  (mesh.userData.texture as THREE.CanvasTexture).needsUpdate = true;
}

/** Plain brushed-steel sliding door leaf (placeholder for the Mint model). */
function makeProceduralDoorLeaf(): THREE.Group {
  const group = new THREE.Group();
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.62, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0xe0e4e7,
      metalness: 0.92,
      roughness: 0.22,
    }),
  );
  leaf.position.y = 1.31;
  group.add(leaf);
  // Slim darker edge strip along the meeting edge, like real lift doors.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 2.62, 0.065),
    new THREE.MeshStandardMaterial({
      color: 0x9aa0a4,
      metalness: 0.85,
      roughness: 0.4,
    }),
  );
  strip.position.set(0.59, 1.31, 0);
  group.add(strip);
  return group;
}

/** Small engraved-style label for a live floor button. */
function buttonLabelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#33373a";
  ctx.font = "600 30px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function buildWorld(assets: AssetMap): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x494f4a);
  scene.fog = new THREE.Fog(0x494f4a, 26, 110);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xcfd6c8, 0x33362f, 0.85);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x9aa094, 0.5);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xfff2dd, 1.1);
  keyLight.position.set(3, 8, 6);
  scene.add(keyLight);

  // ---------- elevator cab ----------
  const cabGroup = new THREE.Group();
  scene.add(cabGroup);

  const cab = assets.get("elevator-cab");
  if (cab) cabGroup.add(cab);

  const cabLight = new THREE.PointLight(0xffe2b0, 10, 8, 1.6);
  cabLight.position.set(0, 2.35, 0);
  cabGroup.add(cabLight);
  // Soft warm fill so the cab walls read brighter without shifting the
  // scene's overall palette.
  const cabFill = new THREE.PointLight(0xfff6e8, 3, 6, 1.8);
  cabFill.position.set(0, 0.85, 0.3);
  cabGroup.add(cabFill);

  // Door pair: one panel, instanced and mirrored. PLACEHOLDER: generated
  // door leaves kept arriving with baked ornament and regens are blocked on
  // Mint credits, so a plain brushed-steel slab stands in for now.
  const doorL = new THREE.Group();
  const doorR = new THREE.Group();
  const panel = assets.get("door-panel") ?? makeProceduralDoorLeaf();
  if (panel) {
    doorL.add(panel);
    const clone = panel.clone(true);
    clone.scale.x *= -1;
    // Mirroring flips winding; give the clone its own double-sided materials
    // so single-sided faces stay visible.
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => {
          const copy = mat.clone();
          copy.side = THREE.DoubleSide;
          return copy;
        });
      } else {
        const copy = mesh.material.clone();
        copy.side = THREE.DoubleSide;
        mesh.material = copy;
      }
    });
    doorR.add(clone);
  }
  doorL.position.set(-DOOR_CLOSED_X, 0, DOOR_Z);
  doorR.position.set(DOOR_CLOSED_X, 0, DOOR_Z);
  cabGroup.add(doorL, doorR);

  // Steel control panel: 7 live floor buttons plus dummy placeholders, built
  // procedurally (the generated cab is prompted with bare walls).
  const buttonHits: THREE.Mesh[] = [];
  const panelGroup = new THREE.Group();
  panelGroup.position.set(-1.16, 1.32, -0.5);
  panelGroup.rotation.y = Math.PI / 2; // plate faces the cab centre (+x)
  cabGroup.add(panelGroup);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.2, 0.025),
    new THREE.MeshStandardMaterial({
      color: 0xb4b8bb,
      metalness: 0.85,
      roughness: 0.32,
    }),
  );
  panelGroup.add(plate);

  const buttonGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.016, 20);
  buttonGeo.rotateX(Math.PI / 2);
  const hitGeo = new THREE.SphereGeometry(0.048, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const realMat = new THREE.MeshStandardMaterial({
    color: 0xdadddf,
    metalness: 0.9,
    roughness: 0.25,
    emissive: 0xc9a86a,
    emissiveIntensity: 0.12,
  });
  const dummyMat = new THREE.MeshStandardMaterial({
    color: 0x989da1,
    metalness: 0.85,
    roughness: 0.4,
  });

  const COLS = [-0.135, -0.045, 0.045, 0.135];
  const ROW0 = 0.47;
  const ROW_STEP = 0.128;
  // Real stops run down the third column, roof at the top.
  const REAL_COL = 2;
  const BUTTON_Z = 0.021;

  let realIndex = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const x = COLS[col];
      const y = ROW0 - row * ROW_STEP;
      const isReal = col === REAL_COL && realIndex < BUTTON_FLOORS.length;
      const button = new THREE.Mesh(
        buttonGeo,
        (isReal ? realMat : dummyMat).clone(),
      );
      button.position.set(x, y, BUTTON_Z);
      button.userData.baseZ = BUTTON_Z;
      panelGroup.add(button);

      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.set(x, y, BUTTON_Z);
      panelGroup.add(hit);

      if (isReal) {
        const bf = BUTTON_FLOORS[realIndex++];
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(0.034, 0.034),
          new THREE.MeshBasicMaterial({
            map: buttonLabelTexture(bf.label),
            transparent: true,
          }),
        );
        label.position.set(x, y, BUTTON_Z + 0.0095);
        panelGroup.add(label);
        hit.userData = { story: bf.story, label: bf.label, button };
      } else {
        hit.userData = { dummy: true, button };
      }
      buttonHits.push(hit);
    }
  }

  // ---------- floor dioramas ----------
  const dioramas = new Map<number, THREE.Group>();
  const dioramaLights = new Map<number, THREE.PointLight>();
  let landingIndicator: THREE.Mesh | null = null;
  for (const stop of STOPS) {
    if (!stop.dioramaKey) continue;
    const model = assets.get(stop.dioramaKey);
    if (!model && stop.dioramaKey === "landing") {
      // PLACEHOLDER: bright lobby wall with a door aperture, standing in
      // until the blocked Mint lobby generation completes.
      const holder = new THREE.Group();
      holder.position.set(0, storyY(stop.story), 0);
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-12, 0);
      wallShape.lineTo(12, 0);
      wallShape.lineTo(12, 3.95);
      wallShape.lineTo(-12, 3.95);
      wallShape.closePath();
      // Aperture slightly smaller than the door pair (±1.2 × 2.62) so the
      // wall overlaps the panels on every edge — no see-through gaps.
      const doorHole = new THREE.Path();
      doorHole.moveTo(-1.15, 0);
      doorHole.lineTo(1.15, 0);
      doorHole.lineTo(1.15, 2.55);
      doorHole.lineTo(-1.15, 2.55);
      doorHole.closePath();
      wallShape.holes.push(doorHole);
      const wall = new THREE.Mesh(
        new THREE.ExtrudeGeometry(wallShape, { depth: 0.12, bevelEnabled: false }),
        new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.85 }),
      );
      wall.position.z = -1.38;
      holder.add(wall);
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0xb4b8bb,
        metalness: 0.85,
        roughness: 0.3,
      });
      // Head casing and indicator sit proud of the wall's camera-facing
      // plane (z = -1.38); anything behind it is hidden from the lobby.
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.14, 0.1), steelMat);
      frame.position.set(0, 2.64, -1.43);
      holder.add(frame);
      for (const jx of [-1.42, 1.42]) {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 2.72, 0.1),
          steelMat,
        );
        jamb.position.set(jx, 1.35, -1.43);
        holder.add(jamb);
      }

      // Floor indicator screen above the doors.
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.38, 0.09),
        new THREE.MeshStandardMaterial({
          color: 0x22262a,
          roughness: 0.45,
          metalness: 0.4,
        }),
      );
      housing.position.set(0, 3.02, -1.43);
      holder.add(housing);

      const indicatorCanvas = document.createElement("canvas");
      indicatorCanvas.width = 256;
      indicatorCanvas.height = 96;
      const indicatorTex = new THREE.CanvasTexture(indicatorCanvas);
      indicatorTex.colorSpace = THREE.SRGBColorSpace;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.74, 0.26),
        new THREE.MeshBasicMaterial({ map: indicatorTex, toneMapped: false }),
      );
      screen.position.set(0, 3.02, -1.481);
      screen.rotation.y = Math.PI;
      screen.userData.canvas = indicatorCanvas;
      screen.userData.texture = indicatorTex;
      holder.add(screen);
      landingIndicator = screen;
      // The visitor now starts well back from the doors, so the bay needs a
      // real room around it: floor, ceiling and lighting down the approach.
      const LOBBY_BACK = -1.26;
      const LOBBY_FRONT = -17;
      const LOBBY_DEPTH = LOBBY_BACK - LOBBY_FRONT;
      const LOBBY_MID = (LOBBY_BACK + LOBBY_FRONT) / 2;
      const CEIL_Y = 3.9;

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(24, 0.1, LOBBY_DEPTH),
        // Matte tiled stone. A polished floor mirrors the environment at
        // grazing angles and blows out the whole lower frame.
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: (() => {
            const tex = makeFloorTexture();
            tex.repeat.set(24 / 2.6, LOBBY_DEPTH / 2.6);
            return tex;
          })(),
          roughness: 0.78,
          metalness: 0,
        }),
      );
      // Sits a hair above the shaft slab so the two never z-fight.
      floor.position.set(0, -0.03, LOBBY_MID);
      holder.add(floor);

      // Close the room off: without an end wall and returns, the view out of
      // the open cab doors runs straight past the lobby into empty sky.
      const roomMat = new THREE.MeshStandardMaterial({
        color: 0xb9b5ad,
        roughness: 0.92,
      });
      const endWall = new THREE.Mesh(
        new THREE.BoxGeometry(24, 3.95, 0.12),
        roomMat,
      );
      endWall.position.set(0, 1.975, LOBBY_FRONT);
      holder.add(endWall);
      for (const sx of [-12, 12]) {
        const side = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 3.95, LOBBY_DEPTH),
          roomMat,
        );
        side.position.set(sx, 1.975, LOBBY_MID);
        holder.add(side);
      }

      const ceiling = new THREE.Mesh(
        new THREE.BoxGeometry(24, 0.12, LOBBY_DEPTH),
        new THREE.MeshStandardMaterial({
          color: 0xdedbd4,
          roughness: 0.95,
          emissive: 0x3a3833,
          emissiveIntensity: 1,
        }),
      );
      ceiling.position.set(0, CEIL_Y, LOBBY_MID);
      holder.add(ceiling);

      // Recessed ceiling strips receding toward the lift.
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0xfff6e6,
        emissive: 0xfff0d8,
        emissiveIntensity: 1.6,
        roughness: 0.4,
      });
      for (let i = 0; i < 5; i++) {
        const z = -2.9 - i * 2.9;
        for (const sx of [-3.1, 3.1]) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.05, 0.34),
            stripMat,
          );
          strip.position.set(sx, CEIL_Y - 0.09, z);
          holder.add(strip);
        }
      }

      // Office downlights washing the doors, plus fill down the approach.
      for (const sx of [-1.7, 0, 1.7]) {
        const spot = new THREE.SpotLight(0xfff4e2, 9, 9, 0.55, 0.65, 1.4);
        spot.position.set(sx, 3.8, -2.1);
        spot.target.position.set(sx * 0.7, 0, -1.5);
        holder.add(spot, spot.target);
      }
      for (let i = 0; i < 4; i++) {
        const z = -4.6 - i * 3.2;
        const fill = new THREE.PointLight(0xfff2e0, 2.0, 10, 1.8);
        fill.position.set(0, CEIL_Y - 0.4, z);
        holder.add(fill);
      }

      // Wall detailing so the bay still reads as a lobby from a distance:
      // stone skirting and a pair of darker panels flanking the doors.
      // Detailing sits proud of the wall's camera-facing plane (z = -1.38),
      // not inside the extrusion.
      const WALL_FACE = -1.4;
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(24, 0.16, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x6d6b67, roughness: 0.5 }),
      );
      skirt.position.set(0, 0.08, WALL_FACE);
      holder.add(skirt);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0xcac6be,
        roughness: 0.65,
      });
      for (const px of [-2.45, 2.45]) {
        const sidePanel = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 3.1, 0.05),
          panelMat,
        );
        sidePanel.position.set(px, 1.66, WALL_FACE);
        holder.add(sidePanel);
      }
      // Lobby contents. Kept clear of the centre line so the approach dolly
      // and the view back out of the cab both stay unobstructed, while the
      // frame still has something to read depth against.
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x4b4b49,
        roughness: 0.6,
        metalness: 0.15,
      });
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xa39c8e,
        roughness: 0.75,
      });
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x46614a,
        roughness: 0.85,
      });

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 1.05, 0.75),
        darkMat,
      );
      counter.position.set(-5.4, 0.52, -6.6);
      holder.add(counter);
      const counterTop = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.07, 0.9),
        stoneMat,
      );
      counterTop.position.set(-5.4, 1.08, -6.6);
      holder.add(counterTop);
      const backPanel = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 2.5, 0.12),
        stoneMat,
      );
      backPanel.position.set(-5.4, 1.25, -7.5);
      holder.add(backPanel);

      for (const pz of [-5.2, -9.4]) {
        const pot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), darkMat);
        pot.position.set(3.9, 0.35, pz);
        holder.add(pot);
        const foliage = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 12, 10),
          leafMat,
        );
        foliage.position.set(3.9, 1.16, pz);
        foliage.scale.set(1, 1.25, 1);
        holder.add(foliage);
      }

      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.62), stoneMat);
      bench.position.set(5.2, 0.44, -12.2);
      holder.add(bench);
      for (const bx of [4.25, 6.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.5), darkMat);
        leg.position.set(bx, 0.19, -12.2);
        holder.add(leg);
      }

      for (const cx of [-8.6, 8.6]) {
        for (const cz of [-5.4, -11.2]) {
          const column = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 3.95, 0.55),
            stoneMat,
          );
          column.position.set(cx, 1.975, cz);
          holder.add(column);
        }
      }

      scene.add(holder);
      dioramas.set(stop.story, holder);
      continue;
    }
    if (!model) continue;
    const holder = new THREE.Group();
    holder.position.set(0, storyY(stop.story), DIORAMA_Z);
    holder.add(model);
    // Room depths vary per generated model; measure each one and seat its
    // front face just behind the door plane so nothing pokes into the cab.
    // The landing is special: its aperture wall (bbox +z side after yaw)
    // sits AT the door plane so the cab doors show inside its steel frame.
    const roomBox = new THREE.Box3().setFromObject(model);
    model.position.z =
      stop.dioramaKey === "landing"
        ? 0.16 - roomBox.max.z
        : -0.06 - roomBox.max.z;
    scene.add(holder);
    dioramas.set(stop.story, holder);

    const glow = new THREE.PointLight(stop.mood.glow, 3.2, 9, 1.8);
    glow.position.set(0, storyY(stop.story) + 2.3, DIORAMA_Z - 1.6);
    scene.add(glow);
    dioramaLights.set(stop.story, glow);
  }

  // ---------- shaft (x-ray view) ----------
  const shaft = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x5a5f58,
    metalness: 0.4,
    roughness: 0.6,
  });
  const railGeo = new THREE.BoxGeometry(0.14, TOWER_HEIGHT, 0.14);
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-1.38, TOWER_HEIGHT / 2, 0.82);
  const railR = railL.clone();
  railR.position.x = 1.38;
  shaft.add(railL, railR);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e2e2a, roughness: 0.8 }),
  );
  shaft.add(cable);

  const counterweight = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.5, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x3c4038,
      metalness: 0.3,
      roughness: 0.7,
    }),
  );
  counterweight.position.z = 0.95;
  shaft.add(counterweight);
  scene.add(shaft);

  // ---------- passing floor slabs (seen in x-ray; sell vertical motion) ----------
  // Each slab has a rectangular cutout around the shaft so the cab, its
  // sliding doors, and the camera never intersect a floor while travelling.
  const slabCount = ROOF_STORY + 1;
  const slabShape = new THREE.Shape();
  slabShape.moveTo(-3.8, -3.8);
  slabShape.lineTo(3.8, -3.8);
  slabShape.lineTo(3.8, 3.8);
  slabShape.lineTo(-3.8, 3.8);
  slabShape.closePath();
  const shaftHole = new THREE.Path();
  // Shape y maps to world -z: rear edge z=+1.55, front (door-side) z=-1.35.
  shaftHole.moveTo(-2.3, -1.55);
  shaftHole.lineTo(2.3, -1.55);
  shaftHole.lineTo(2.3, 1.35);
  shaftHole.lineTo(-2.3, 1.35);
  shaftHole.closePath();
  slabShape.holes.push(shaftHole);
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
    depth: 0.16,
    bevelEnabled: false,
  });
  slabGeo.rotateX(-Math.PI / 2);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x3f453f,
    roughness: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, slabCount);
  const m = new THREE.Matrix4();
  for (let s = 0; s <= ROOF_STORY; s++) {
    m.setPosition(0, storyY(s) - 0.16, 0);
    slabs.setMatrixAt(s, m);
  }
  slabs.instanceMatrix.needsUpdate = true;
  scene.add(slabs);

  // ---------- translucent building shell (x-ray) ----------
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, TOWER_HEIGHT, 8.6),
    new THREE.MeshBasicMaterial({
      color: 0x76816f,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  shell.position.y = TOWER_HEIGHT / 2;
  scene.add(shell);

  // ---------- sky ----------
  const starGeo = new THREE.BufferGeometry();
  const starCount = 700;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 320 + Math.random() * 160;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 30;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xe8e4d8,
      size: 0.9,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: false,
      fog: false,
    }),
  );
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(18, 40),
    new THREE.MeshBasicMaterial({
      color: 0xe9ded0,
      transparent: true,
      opacity: 0,
      fog: false,
    }),
  );
  moon.position.set(-90, storyY(ROOF_STORY) + 70, -260);
  scene.add(moon);

  // ---------- ground lobby light (intro shot) ----------
  const lobbyLight = new THREE.PointLight(0xfff2dd, 4, 11, 1.6);
  lobbyLight.position.set(0, 3.0, -3.2);
  scene.add(lobbyLight);

  // ---------- roof deck ----------
  const roofDeck = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 0.3, 10.5),
    new THREE.MeshStandardMaterial({ color: 0x494f47, roughness: 0.95 }),
  );
  deck.position.y = storyY(ROOF_STORY) - 0.15;
  roofDeck.add(deck);
  const parapetMat = new THREE.MeshStandardMaterial({
    color: 0x3c423b,
    roughness: 0.9,
  });
  for (const [px, pz, w, d] of [
    [0, -5.1, 10.5, 0.3],
    [0, 5.1, 10.5, 0.3],
    [-5.1, 0, 0.3, 10.5],
    [5.1, 0, 0.3, 10.5],
  ]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), parapetMat);
    parapet.position.set(px, storyY(ROOF_STORY) + 0.5, pz);
    roofDeck.add(parapet);
  }
  scene.add(roofDeck);

  // ---------- tower (finale reveal) ----------
  const tower = new THREE.Group();
  const towerModel = assets.get("tower");
  if (towerModel) tower.add(towerModel);
  tower.visible = false;
  scene.add(tower);

  // ---------- passengers ----------
  const passengerRoots = new Map<string, THREE.Group>();
  for (const def of PASSENGERS) {
    const model = assets.get(def.key);
    if (!model) continue;
    const root = new THREE.Group();
    root.add(model);
    root.userData = { passengerKey: def.key };
    root.traverse((o) => {
      o.userData.passengerKey = def.key;
    });
    scene.add(root);
    passengerRoots.set(def.key, root);
  }

  return {
    scene,
    cabGroup,
    doorL,
    doorR,
    dioramas,
    dioramaLights,
    tower,
    shell,
    shaft,
    counterweight,
    cable,
    slabs,
    stars,
    moon,
    roofDeck,
    cabLight,
    hemi,
    ambient,
    keyLight,
    buttonHits,
    buttonPanel: panelGroup,
    landingIndicator,
    passengerRoots,
  };
}
