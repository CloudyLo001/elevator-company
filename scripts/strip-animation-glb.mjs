/**
 * Mint ships each animation clip as a full GLB: the whole rigged character,
 * its textures and the clip. We only ever read `gltf.animations[0]` from these
 * files, so the mesh payload is pure download weight — about 2.8 MB per clip,
 * fourteen times over.
 *
 * This rewrites each clip GLB in place, keeping the node hierarchy (animation
 * channels target it) and the accessors the samplers read, and dropping
 * meshes, skins, materials, textures and images.
 *
 * Usage: node scripts/strip-animation-glb.mjs public/assets/mint/*-idle/...
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error("not a GLB");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.byteLength) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === JSON_CHUNK) {
      json = JSON.parse(buf.subarray(start, start + len).toString("utf8"));
    } else if (type === BIN_CHUNK) {
      bin = buf.subarray(start, start + len);
    }
    offset = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error("no JSON chunk");
  return { json, bin: bin ?? Buffer.alloc(0) };
}

function buildGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuf.byteLength % 4)) % 4;
  const binPad = (4 - (bin.byteLength % 4)) % 4;
  const total =
    12 +
    8 + jsonBuf.byteLength + jsonPad +
    (bin.byteLength ? 8 + bin.byteLength + binPad : 0);

  const out = Buffer.alloc(total);
  out.writeUInt32LE(MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  let p = 12;
  out.writeUInt32LE(jsonBuf.byteLength + jsonPad, p);
  out.writeUInt32LE(JSON_CHUNK, p + 4);
  jsonBuf.copy(out, p + 8);
  out.fill(0x20, p + 8 + jsonBuf.byteLength, p + 8 + jsonBuf.byteLength + jsonPad);
  p += 8 + jsonBuf.byteLength + jsonPad;

  if (bin.byteLength) {
    out.writeUInt32LE(bin.byteLength + binPad, p);
    out.writeUInt32LE(BIN_CHUNK, p + 4);
    bin.copy(out, p + 8);
  }
  return out;
}

function strip(file) {
  const before = statSync(file).size;
  const { json, bin } = parseGlb(readFileSync(file));
  if (!json.animations?.length) {
    console.log(`skip (no animations): ${file}`);
    return 0;
  }

  // Accessors reachable from animation samplers.
  const keep = new Set();
  for (const anim of json.animations) {
    for (const s of anim.samplers ?? []) {
      if (s.input !== undefined) keep.add(s.input);
      if (s.output !== undefined) keep.add(s.output);
    }
  }

  const accessorMap = new Map();
  const accessors = [];
  const bufferViews = [];
  const chunks = [];
  let binLength = 0;

  for (const index of [...keep].sort((a, b) => a - b)) {
    const src = json.accessors[index];
    const copy = { ...src };
    if (src.bufferView !== undefined) {
      const view = json.bufferViews[src.bufferView];
      const start = view.byteOffset ?? 0;
      const slice = bin.subarray(start, start + view.byteLength);
      const pad = (4 - (binLength % 4)) % 4;
      if (pad) {
        chunks.push(Buffer.alloc(pad));
        binLength += pad;
      }
      copy.bufferView = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset: binLength,
        byteLength: view.byteLength,
        ...(view.byteStride !== undefined ? { byteStride: view.byteStride } : {}),
      });
      chunks.push(slice);
      binLength += slice.byteLength;
      delete copy.byteOffset;
      if (src.byteOffset) {
        // Fold any accessor-level offset into the copied slice instead.
        const inner = bin.subarray(start + src.byteOffset, start + view.byteLength);
        chunks[chunks.length - 1] = inner;
        binLength -= slice.byteLength - inner.byteLength;
        bufferViews[bufferViews.length - 1].byteLength = inner.byteLength;
      }
    }
    accessorMap.set(index, accessors.length);
    accessors.push(copy);
  }

  const animations = json.animations.map((anim) => ({
    ...anim,
    samplers: (anim.samplers ?? []).map((s) => ({
      ...s,
      input: accessorMap.get(s.input),
      output: accessorMap.get(s.output),
    })),
  }));

  // Keep the node hierarchy (channels target it) but drop geometry links.
  const nodes = (json.nodes ?? []).map((n) => {
    const copy = { ...n };
    delete copy.mesh;
    delete copy.skin;
    delete copy.camera;
    return copy;
  });

  const out = {
    asset: json.asset,
    scene: json.scene ?? 0,
    scenes: json.scenes ?? [{ nodes: [] }],
    nodes,
    animations,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }],
  };

  const newBin = Buffer.concat(chunks, binLength);
  writeFileSync(file, buildGlb(out, newBin));
  const after = statSync(file).size;
  console.log(
    `${file}: ${(before / 1e6).toFixed(2)}MB -> ${(after / 1e6).toFixed(2)}MB`,
  );
  return before - after;
}

const ROOT = "public/assets/mint";
const files = readdirSync(ROOT)
  .filter((d) => /^passenger-.*-(idle|walk)$/.test(d))
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith(".glb"))
      .map((f) => join(ROOT, d, f)),
  );
let saved = 0;
for (const f of files) saved += strip(f);
console.log(`\n${files.length} clips, saved ${(saved / 1e6).toFixed(1)} MB`);
