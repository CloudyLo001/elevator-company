import * as THREE from "three";
import { PASSENGERS, type PassengerDef, storyY } from "./content";
import { windowForStory } from "./timeline";

/**
 * Passenger positions are a pure function of beat time, so boarding and
 * exiting scrub cleanly when the visitor scrolls backwards.
 */

interface Choreo {
  def: PassengerDef;
  boardStart: number;
  boardEnd: number;
  turnEnd: number;
  exitStart: number;
  exitEnd: number;
  boardY: number;
  exitY: number;
}

const choreos: Choreo[] = PASSENGERS.map((def, i) => {
  const bw = windowForStory(def.boardStory);
  const ew = windowForStory(def.exitStory);
  if (!bw || !ew) throw new Error(`No stop window for passenger ${def.key}`);
  const bSpan = bw.closeStart - bw.open;
  const eSpan = ew.closeStart - ew.open;
  const jitter = (i % 3) * 0.06;
  // Exits use the first 45% of a dwell, entries the back 50% — so at floor 12
  // Amara steps out before Daichi and Naomi step in.
  const boardStart = bw.open + bSpan * (0.5 + jitter * 0.3);
  const boardEnd = boardStart + bSpan * 0.4;
  return {
    def,
    boardStart,
    boardEnd,
    turnEnd: boardEnd + 0.18,
    exitStart: ew.open + eSpan * (0.04 + jitter * 0.5),
    exitEnd: ew.open + eSpan * (0.42 + jitter * 0.3),
    boardY: storyY(def.boardStory),
    exitY: storyY(def.exitStory),
  };
});

function smooth(u: number): number {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
}

const FACE_DOORS = Math.PI; // riding: face -z (the doors), backs to camera

function walkYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

function lerpAngle(a: number, b: number, u: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

const BOB_FREQ = 8.5;

export function updatePassengers(
  t: number,
  cabY: number,
  roots: Map<string, THREE.Group>,
): void {
  for (const c of choreos) {
    const root = roots.get(c.def.key);
    if (!root) continue;
    const { def } = c;
    const [sx, sz] = def.slot;
    const [fx, fz] = def.from;
    const [tx, tz] = def.to;

    let x: number, y: number, z: number, yaw: number;
    let bob = 0;

    if (t < c.boardStart) {
      // Waiting in the origin diorama, facing the landing doors.
      x = fx;
      z = fz;
      y = c.boardY;
      yaw = 0;
    } else if (t < c.boardEnd) {
      const u = smooth((t - c.boardStart) / (c.boardEnd - c.boardStart));
      x = fx + (sx - fx) * u;
      z = fz + (sz - fz) * u;
      y = c.boardY;
      yaw = walkYaw(sx - fx, sz - fz);
      bob = Math.sin(u * Math.PI * BOB_FREQ) * 0.02;
    } else if (t < c.turnEnd) {
      // The classic elevator about-face after stepping in.
      const u = smooth((t - c.boardEnd) / (c.turnEnd - c.boardEnd));
      x = sx;
      z = sz;
      y = cabY;
      yaw = lerpAngle(walkYaw(sx - fx, sz - fz), FACE_DOORS, u);
    } else if (t < c.exitStart) {
      x = sx;
      z = sz;
      y = cabY;
      yaw = FACE_DOORS;
    } else if (t < c.exitEnd) {
      const u = smooth((t - c.exitStart) / (c.exitEnd - c.exitStart));
      x = sx + (tx - sx) * u;
      z = sz + (tz - sz) * u;
      y = c.exitY;
      yaw = walkYaw(tx - sx, tz - sz);
      bob = Math.sin(u * Math.PI * BOB_FREQ) * 0.02;
    } else {
      // Arrived: stands in the destination room, looking back at the car.
      x = tx;
      z = tz;
      y = c.exitY;
      yaw = 0;
    }

    root.position.set(x, y + bob, z);
    root.rotation.y = yaw;
  }
}

export function passengerByKey(key: string): PassengerDef | undefined {
  return PASSENGERS.find((p) => p.key === key);
}
