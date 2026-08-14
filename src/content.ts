/** Authored content for the Elevate ride: floors, passengers, copy. */

export const FLOOR_HEIGHT = 4;
export const ROOF_STORY = 62;

export interface FloorStop {
  /** Story number shown on the indicator; "G" for ground. */
  story: number;
  label: string;
  dioramaKey: string;
  kicker: string;
  title: string;
  quote: string;
  product: string;
  kanji: string;
  reading: string;
  /** Scene mood — ambient tint and fog color while stopped here. */
  mood: { sky: number; ambient: number; glow: number };
}

export const STOPS: FloorStop[] = [
  {
    story: 0,
    label: "G",
    dioramaKey: "landing",
    kicker: "GROUND FLOOR",
    title: "The threshold.",
    quote:
      "Every journey through a building begins with a single set of doors.",
    product: "ELEVATE — VERTICAL TRANSIT SYSTEMS",
    kanji: "玄関",
    reading: "GENKAN",
    mood: { sky: 0x494f4a, ambient: 0x9aa094, glow: 0xf3c877 },
  },
  {
    story: 1,
    label: "1",
    dioramaKey: "diorama-hotel",
    kicker: "FLOOR / 01 — HOTEL LOBBY",
    title: "Arrivals, handled gently.",
    quote:
      "A guest's first impression rides with us. Whisper-quiet traction, a landing soft as folded linen.",
    product: "ELEVATE HOSPITALITY — SMOOTH-RIDE TRACTION",
    kanji: "旅館",
    reading: "RYOKAN",
    mood: { sky: 0x574f42, ambient: 0xb9a488, glow: 0xf3c877 },
  },
  {
    story: 12,
    label: "12",
    dioramaKey: "diorama-office",
    kicker: "FLOOR / 12 — CORPORATE OFFICE",
    title: "Nine hundred people, on time.",
    quote:
      "Destination dispatch reads the morning rush like a timetable, and quietly rewrites it.",
    product: "ELEVATE ENTERPRISE — DESTINATION DISPATCH",
    kanji: "仕事",
    reading: "SHIGOTO",
    mood: { sky: 0x46504e, ambient: 0x93a49c, glow: 0xd9e2da },
  },
  {
    story: 27,
    label: "27",
    dioramaKey: "diorama-apartment",
    kicker: "FLOOR / 27 — PRIVATE RESIDENCES",
    title: "Home begins in the hallway.",
    quote:
      "Keyed access, silent night mode. The only thing a resident should hear is the kettle.",
    product: "ELEVATE RESIDENCE — PRIVATE ACCESS",
    kanji: "住居",
    reading: "JŪKYO",
    mood: { sky: 0x4d4450, ambient: 0xa08fa0, glow: 0xe8b988 },
  },
  {
    story: 43,
    label: "43",
    dioramaKey: "diorama-restaurant",
    kicker: "FLOOR / 43 — RESTAURANT",
    title: "Service, elevated.",
    quote:
      "Forty-three floors and not a ripple in the broth. Finish options in brass, walnut, and stone.",
    product: "ELEVATE SERVICE — FREIGHT-RATED FINISHES",
    kanji: "食事",
    reading: "SHOKUJI",
    mood: { sky: 0x3d3234, ambient: 0xa08078, glow: 0xe8543f },
  },
  {
    story: 60,
    label: "60",
    dioramaKey: "diorama-penthouse",
    kicker: "FLOOR / 60 — PENTHOUSE",
    title: "The quiet at the top.",
    quote:
      "The last passenger steps out. For one floor more, the car belongs to the night.",
    product: "ELEVATE SIGNATURE — BESPOKE CABINS",
    kanji: "天空",
    reading: "TENKŪ",
    mood: { sky: 0x2b3040, ambient: 0x707a94, glow: 0xd8ba8a },
  },
  {
    story: ROOF_STORY,
    label: "R",
    dioramaKey: "",
    kicker: "ROOFTOP",
    title: "",
    quote: "",
    product: "",
    kanji: "屋上",
    reading: "OKUJŌ",
    mood: { sky: 0x232838, ambient: 0x5c6478, glow: 0xd8ba8a },
  },
];

export interface PassengerDef {
  key: string;
  name: string;
  boardStory: number;
  exitStory: number;
  story: string;
  /** Standing slot inside the cab, local x/z. */
  slot: [number, number];
  /** Where they stand in the diorama before boarding, local to diorama front. */
  from: [number, number];
  /** Where they end up standing after exiting. */
  to: [number, number];
}

export const PASSENGERS: PassengerDef[] = [
  {
    key: "passenger-bellhop",
    name: "Kenji",
    boardStory: 1,
    exitStory: 43,
    story: "A birthday cake rides on the trolley. It must not tilt.",
    slot: [-0.62, 0.15],
    from: [-0.9, -2.6],
    to: [0.8, -2.4],
  },
  {
    key: "passenger-guest",
    name: "Amara",
    boardStory: 1,
    exitStory: 12,
    story: "Early for the interview, rehearsing her opening line.",
    slot: [0.6, 0.2],
    from: [0.9, -2.8],
    to: [-0.7, -2.5],
  },
  {
    key: "passenger-worker-a",
    name: "Daichi",
    boardStory: 12,
    exitStory: 43,
    story: "A lunch reservation he has no intention of losing.",
    slot: [0.62, -0.5],
    from: [0.7, -2.5],
    to: [-0.9, -2.6],
  },
  {
    key: "passenger-worker-b",
    name: "Naomi",
    boardStory: 12,
    exitStory: 60,
    story: "Pitching the penthouse client at three o'clock sharp.",
    slot: [-0.6, -0.55],
    from: [-0.8, -2.7],
    to: [0.9, -2.5],
  },
  {
    key: "passenger-resident",
    name: "Mr. Sato & Mochi",
    boardStory: 27,
    exitStory: 60,
    story: "The rooftop garden is Mochi's favorite hour of the day.",
    slot: [0.05, -0.1],
    from: [0.0, -2.6],
    to: [-0.2, -2.8],
  },
  {
    key: "passenger-server",
    name: "Mika",
    boardStory: 43,
    exitStory: 60,
    story: "A tasting menu for the sixtieth floor, still warm.",
    slot: [-0.15, 0.45],
    from: [-0.4, -2.4],
    to: [0.5, -2.6],
  },
  {
    key: "passenger-evening",
    name: "Rei",
    boardStory: 43,
    exitStory: 60,
    story: "Floor 60. Home.",
    slot: [0.3, 0.55],
    from: [1.1, -2.7],
    to: [1.0, -2.4],
  },
];

/** Floors reachable from the cab button panel, top to bottom. */
export const BUTTON_FLOORS: { label: string; story: number }[] = [
  { label: "R", story: ROOF_STORY },
  { label: "60", story: 60 },
  { label: "43", story: 43 },
  { label: "27", story: 27 },
  { label: "12", story: 12 },
  { label: "1", story: 1 },
  { label: "G", story: 0 },
];

export function storyY(story: number): number {
  return story * FLOOR_HEIGHT;
}
