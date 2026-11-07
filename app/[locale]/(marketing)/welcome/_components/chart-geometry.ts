/**
 * Deterministic nautical-chart geometry for the landing hero: depth contours
 * around a coastline, soundings, and buoy positions. Pure — safe on the server.
 */
type Pt = [number, number];

function ring(cx: number, cy: number, r: number, seed: number, n = 56): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k =
      1 +
      0.13 * Math.sin(3 * t + seed) +
      0.07 * Math.sin(5 * t + seed * 2.1) +
      0.04 * Math.sin(9 * t + seed * 3.7);
    pts.push([cx + Math.cos(t) * r * k * 1.25, cy + Math.sin(t) * r * k]);
  }
  return pts;
}

/** Closed Catmull-Rom spline through the points, as an SVG path. */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  const p = (i: number) => pts[(i + n) % n];
  let d = `M${p(0)[0].toFixed(1)},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

const COAST = { cx: 740, cy: 30, seed: 1.7 };
const LEVELS = [150, 205, 270, 345, 430, 525, 630, 745];

export const land = smooth(ring(COAST.cx, COAST.cy, 110, COAST.seed));
export const contours = LEVELS.map((r, i) => smooth(ring(COAST.cx, COAST.cy, r, COAST.seed + i * 0.22)));
export const islet = smooth(ring(300, 150, 16, 0.4, 24));
export const isletRings = [34, 60].map((r, i) => smooth(ring(300, 150, r, 0.4 + i * 0.3, 32)));

/** Depth soundings in metres, placed in open water (deeper further from the coast). */
export const soundings: { x: number; y: number; d: string }[] = [
  { x: 640, y: 190, d: "4" },
  { x: 520, y: 140, d: "7" },
  { x: 860, y: 260, d: "6" },
  { x: 430, y: 260, d: "11" },
  { x: 600, y: 330, d: "12" },
  { x: 800, y: 380, d: "14" },
  { x: 330, y: 380, d: "17" },
  { x: 520, y: 470, d: "19" },
  { x: 710, y: 520, d: "21" },
  { x: 260, y: 520, d: "24" },
  { x: 440, y: 600, d: "26" },
  { x: 830, y: 620, d: "27" },
  { x: 180, y: 250, d: "15" },
  { x: 120, y: 420, d: "28" },
  { x: 620, y: 660, d: "31" },
];

export type Buoy = { id: string; x: number; y: number; label: string; note: string; tone: "port" | "starboard"; order?: number };

export const buoys: Buoy[] = [
  { id: "acme", x: 430, y: 300, label: "Acme Corp", note: "18 days quiet", tone: "port", order: 1 },
  { id: "globex", x: 690, y: 400, label: "Globex", note: "Invoice overdue", tone: "port", order: 2 },
  { id: "initech", x: 360, y: 520, label: "Initech", note: "Stalled 23 days", tone: "port", order: 3 },
  { id: "umbrella", x: 770, y: 330, label: "Umbrella", note: "Replied today", tone: "starboard" },
  { id: "hooli", x: 560, y: 470, label: "Hooli", note: "Meeting Thursday", tone: "starboard" },
  { id: "stark", x: 220, y: 400, label: "Stark Ind.", note: "On course", tone: "starboard" },
];

/** Harbor mouth (between the piers) → buoys 1, 2, 3: today's course. */
const mouth: Pt = [672, 232];
const ordered = buoys.filter((b) => b.order).sort((a, b) => a.order! - b.order!);
export const course = [mouth, ...ordered.map((b) => [b.x, b.y] as Pt)]
  .map((p, i, arr) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const prev = arr[i - 1];
    const mx = (prev[0] + p[0]) / 2 + (i % 2 ? 40 : -40);
    const my = (prev[1] + p[1]) / 2;
    return `Q${mx},${my} ${p[0]},${p[1]}`;
  })
  .join(" ");
export const harborMouth = mouth;
