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
  passengerRoots: Map<string, THREE.Group>;
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
  for (const stop of STOPS) {
    if (!stop.dioramaKey) continue;
    const model = assets.get(stop.dioramaKey);
    if (!model && stop.dioramaKey === "landing") {
      // PLACEHOLDER: bright lobby wall with a door aperture, standing in
      // until the blocked Mint lobby generation completes.
      const holder = new THREE.Group();
      holder.position.set(0, storyY(stop.story), 0);
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-6, 0);
      wallShape.lineTo(6, 0);
      wallShape.lineTo(6, 4.6);
      wallShape.lineTo(-6, 4.6);
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
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 0.2), steelMat);
      frame.position.set(0, 2.66, -1.18);
      holder.add(frame);
      // Lit transom panel above the doors, like an office lift bay.
      const transom = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.62, 0.06),
        new THREE.MeshStandardMaterial({
          color: 0xd9dde0,
          emissive: 0xfff0d8,
          emissiveIntensity: 1.5,
          roughness: 0.5,
        }),
      );
      transom.position.set(0, 3.12, -1.18);
      holder.add(transom);
      const transomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.46, 0.1, 0.14),
        steelMat,
      );
      transomFrame.position.set(0, 3.5, -1.18);
      holder.add(transomFrame);
      // Office downlights washing the wall and doors.
      for (const sx of [-1.7, 0, 1.7]) {
        const spot = new THREE.SpotLight(0xfff4e2, 16, 9, 0.55, 0.65, 1.4);
        spot.position.set(sx, 4.3, -2.1);
        spot.target.position.set(sx * 0.7, 0, -1.5);
        holder.add(spot, spot.target);
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
    passengerRoots,
  };
}
