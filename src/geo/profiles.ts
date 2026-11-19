// Profiles of solids of revolution r(t), t ∈ [0,1] bottom to top. The radius
// is in relative units (a profile's full height = `height` in the same
// units; mm at the boundary). The profiles are control points + a cubic
// Hermite with finite-difference tangents (smooth C1, predictable — almost
// no overshoot).

export interface ProfilePoint {
  t: number;
  r: number;
}

export interface ProfileDef {
  id: string;
  /** the height in the units of r (the shape's aspect) */
  height: number;
  points: ProfilePoint[];
}

function sampledProfile(id: string, height: number, radius: (t: number) => number): ProfileDef {
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    points.push({ t, r: Math.max(0.03, radius(t)) });
  }
  return { id, height, points };
}

export const PROFILES: ProfileDef[] = [
  {
    id: 'vase',
    height: 1.0,
    points: [
      { t: 0, r: 0.24 },
      { t: 0.15, r: 0.36 },
      { t: 0.35, r: 0.42 },
      { t: 0.6, r: 0.3 },
      { t: 0.8, r: 0.16 },
      { t: 0.9, r: 0.15 },
      { t: 1, r: 0.2 },
    ],
  },
  {
    id: 'amphora',
    height: 1.1,
    points: [
      { t: 0, r: 0.12 },
      { t: 0.15, r: 0.3 },
      { t: 0.35, r: 0.4 },
      { t: 0.55, r: 0.36 },
      { t: 0.75, r: 0.18 },
      { t: 0.9, r: 0.12 },
      { t: 1, r: 0.16 },
    ],
  },
  {
    id: 'bottle',
    height: 1.15,
    points: [
      { t: 0, r: 0.3 },
      { t: 0.3, r: 0.31 },
      { t: 0.5, r: 0.3 },
      { t: 0.65, r: 0.18 },
      { t: 0.78, r: 0.1 },
      { t: 1, r: 0.1 },
    ],
  },
  {
    id: 'bowl',
    height: 0.55,
    points: [
      { t: 0, r: 0.16 },
      { t: 0.2, r: 0.3 },
      { t: 0.5, r: 0.42 },
      { t: 0.8, r: 0.48 },
      { t: 1, r: 0.5 },
    ],
  },
  {
    id: 'goblet',
    height: 1.0,
    points: [
      { t: 0, r: 0.3 },
      { t: 0.1, r: 0.28 },
      { t: 0.22, r: 0.1 },
      { t: 0.45, r: 0.08 },
      { t: 0.55, r: 0.16 },
      { t: 0.7, r: 0.3 },
      { t: 0.9, r: 0.34 },
      { t: 1, r: 0.33 },
    ],
  },
  sampledProfile('bezier', 1, (t) => {
    const s = 1 - t;
    return s * s * s * 0.2 + 3 * s * s * t * 0.42 + 3 * s * t * t * 0.12 + t * t * t * 0.24;
  }),
  sampledProfile(
    'gaussian-profile',
    1,
    (t) => 0.16 + 0.28 * Math.exp(-Math.pow((t - 0.38) / 0.24, 2)) + 0.08 * Math.exp(-Math.pow((t - 0.9) / 0.09, 2)),
  ),
  sampledProfile('superellipse-profile', 1, (t) => {
    const y = 2 * t - 1;
    return 0.1 + 0.36 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y), 3)), 1 / 3);
  }),
  sampledProfile('catenary', 1, (t) => 0.16 + 0.15 * (Math.cosh(2.4 * (t - 0.5)) - 1)),
  sampledProfile('tractrix', 1.05, (t) => 0.1 + 0.34 * Math.sqrt(Math.max(0, 1 - Math.pow(0.92 * t, 2)))),
  sampledProfile('stem-bowl', 1.1, (t) => {
    const stem = 0.07 + 0.18 * Math.exp(-Math.pow(t / 0.12, 2));
    const bowl = 0.29 / (1 + Math.exp(-18 * (t - 0.58)));
    const rim = 0.05 * Math.exp(-Math.pow((t - 0.96) / 0.08, 2));
    return stem + bowl + rim;
  }),
  sampledProfile('piecewise', 1, (t) => {
    const smoothstep = (x: number): number => {
      const q = Math.min(1, Math.max(0, x));
      return q * q * (3 - 2 * q);
    };
    if (t < 0.3) return 0.2 + 0.2 * smoothstep(t / 0.3);
    if (t < 0.72) return 0.4 - 0.24 * smoothstep((t - 0.3) / 0.42);
    return 0.16 + 0.1 * smoothstep((t - 0.72) / 0.28);
  }),
];

export const PROFILE_IDS = PROFILES.map((p) => p.id);

export function isProfileId(x: string): boolean {
  return PROFILES.some((p) => p.id === x);
}

export function profileById(id: string): ProfileDef {
  const def = PROFILES.find((p) => p.id === id);
  if (!def) throw new Error(`unknown profile: ${id}`);
  return def;
}

const MIN_RADIUS = 0.02; // a guard against a zero or negative thickness

// --- A profile by formula: a Fourier series r(t) = r₀ + Σ aₖ·sin(kπt + φₖ), k=1..3 ---
// 3 harmonics give a rich family of jugs.

export const FOURIER_PROFILE_ID = 'fourier';
export const FOURIER_HEIGHT = 1.0;

export const DEFAULT_FOURIER_PARAMS: Record<string, number> = {
  r0: 0.3,
  a1: 0.12,
  phi1: 0,
  a2: 0.06,
  phi2: 0,
  a3: 0,
  phi3: 0,
};

export function fourierRadius(p: Record<string, number>, t: number): number {
  const g = (k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);
  let r = g('r0', 0.3);
  r += g('a1', 0) * Math.sin(1 * Math.PI * t + g('phi1', 0));
  r += g('a2', 0) * Math.sin(2 * Math.PI * t + g('phi2', 0));
  r += g('a3', 0) * Math.sin(3 * Math.PI * t + g('phi3', 0));
  return Math.min(1, Math.max(MIN_RADIUS, r));
}

// --- The profile's shape adjustment: radius factors by zones ---
// They make the hard-coded profiles (vase, amphora, …) editable: widen or
// narrow the base, the belly (the wide part) and the neck. Overlapping
// cosine bumps give a smooth result.

export const DEFAULT_PROFILE_SHAPE: Record<string, number> = { base: 0, belly: 0, neck: 0 };

// a cosine bump: 1 at the zone's centre → 0 at its edge (x — the normalised distance 0..1)
function zoneBump(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

const SHAPE_BAND = 0.5; // the width of a zone's influence in t

/** The profile's radius factor of the shape: 1 + base·w₀ + belly·w½ + neck·w₁. */
export function profileShapeFactor(p: Record<string, number>, t: number): number {
  const g = (k: string): number => (Number.isFinite(p[k]) ? p[k] : 0);
  const wBase = zoneBump(t / SHAPE_BAND);
  const wNeck = zoneBump((1 - t) / SHAPE_BAND);
  const wBelly = zoneBump(Math.abs(t - 0.5) / SHAPE_BAND);
  return 1 + g('base') * wBase + g('belly') * wBelly + g('neck') * wNeck;
}

/** A profile's radius with the shape adjustment, clamped from below. */
export function shapedProfileRadius(def: ProfileDef, shape: Record<string, number>, t: number): number {
  return Math.max(MIN_RADIUS, profileRadius(def, t) * profileShapeFactor(shape, t));
}

/** A cubic Hermite over the control points; outside [0,1] — the end values. */
export function profileRadius(def: ProfileDef, t: number): number {
  const pts = def.points;
  if (t <= pts[0].t) return Math.max(MIN_RADIUS, pts[0].r);
  const last = pts[pts.length - 1];
  if (t >= last.t) return Math.max(MIN_RADIUS, last.r);
  let s = 0;
  while (s < pts.length - 2 && pts[s + 1].t <= t) s++;
  const p1 = pts[s];
  const p2 = pts[s + 1];
  const p0 = pts[Math.max(0, s - 1)];
  const p3 = pts[Math.min(pts.length - 1, s + 2)];
  const h = p2.t - p1.t;
  // finite-difference tangents (an uneven grid of nodes)
  const m1 = (p2.r - p0.r) / (p2.t - p0.t);
  const m2 = (p3.r - p1.r) / (p3.t - p1.t);
  const x = (t - p1.t) / h;
  const x2 = x * x;
  const x3 = x2 * x;
  const r = (2 * x3 - 3 * x2 + 1) * p1.r + (x3 - 2 * x2 + x) * h * m1 + (-2 * x3 + 3 * x2) * p2.r + (x3 - x2) * h * m2;
  return Math.max(MIN_RADIUS, r);
}
