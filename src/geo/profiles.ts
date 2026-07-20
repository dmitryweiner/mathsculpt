// Профили тел вращения r(t), t ∈ [0,1] — низ→верх. Радиус в относительных
// единицах (полная высота преcета = height тех же единиц; мм — при экспорте).
// Пресеты — контрольные точки + кубический Эрмит с тангенсами конечных
// разностей (гладкий C1, предсказуемый — почти без перехлёстов).

export interface ProfilePoint {
  t: number;
  r: number;
}

export interface ProfileDef {
  id: string;
  label: string;
  /** высота в тех же единицах, что r (аспект фигуры) */
  height: number;
  points: ProfilePoint[];
}

export const PROFILES: ProfileDef[] = [
  {
    id: 'vase',
    label: 'Vase',
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
    label: 'Amphora',
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
    label: 'Bottle',
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
    label: 'Bowl',
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
    label: 'Goblet',
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

const MIN_RADIUS = 0.02; // страховка от нулевой/отрицательной толщины

// --- Профиль формулой: ряд Фурье r(t) = r₀ + Σ aₖ·sin(kπt + φₖ), k=1..3 ---
// 3 гармоники дают богатое семейство «кувшинов».

export const FOURIER_PROFILE_ID = 'fourier';
export const FOURIER_HEIGHT = 1.0;

export const DEFAULT_FOURIER_PARAMS: Record<string, number> = {
  r0: 0.3, a1: 0.12, phi1: 0, a2: 0.06, phi2: 0, a3: 0, phi3: 0,
};

export function fourierRadius(p: Record<string, number>, t: number): number {
  const g = (k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);
  let r = g('r0', 0.3);
  r += g('a1', 0) * Math.sin(1 * Math.PI * t + g('phi1', 0));
  r += g('a2', 0) * Math.sin(2 * Math.PI * t + g('phi2', 0));
  r += g('a3', 0) * Math.sin(3 * Math.PI * t + g('phi3', 0));
  return Math.min(1, Math.max(MIN_RADIUS, r));
}

// --- Настройка формы пресет-профиля: множители радиуса по зонам ---
// Делают захардкоженные профили (ваза/амфора/…) редактируемыми: расширить/
// сузить основание, «пузо» (широкую часть) и горлышко. Косинусные «горбы»
// с перекрытием дают гладкий результат.

export const DEFAULT_PROFILE_SHAPE: Record<string, number> = { base: 0, belly: 0, neck: 0 };

// косинусный горб: 1 в центре зоны → 0 на её краю (x — норм. расстояние 0..1)
function zoneBump(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

const SHAPE_BAND = 0.5; // ширина зоны влияния по t

/** Множитель радиуса профиля от формы: 1 + base·w₀ + belly·w½ + neck·w₁. */
export function profileShapeFactor(p: Record<string, number>, t: number): number {
  const g = (k: string): number => (Number.isFinite(p[k]) ? p[k] : 0);
  const wBase = zoneBump(t / SHAPE_BAND);
  const wNeck = zoneBump((1 - t) / SHAPE_BAND);
  const wBelly = zoneBump(Math.abs(t - 0.5) / SHAPE_BAND);
  return 1 + g('base') * wBase + g('belly') * wBelly + g('neck') * wNeck;
}

/** Радиус пресет-профиля с учётом настройки формы, с нижним клампом. */
export function shapedProfileRadius(def: ProfileDef, shape: Record<string, number>, t: number): number {
  return Math.max(MIN_RADIUS, profileRadius(def, t) * profileShapeFactor(shape, t));
}

/** Кубический Эрмит по контрольным точкам; вне [0,1] — крайние значения. */
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
  // тангенсы конечных разностей (несимметричная сетка узлов)
  const m1 = (p2.r - p0.r) / (p2.t - p0.t);
  const m2 = (p3.r - p1.r) / (p3.t - p1.t);
  const x = (t - p1.t) / h;
  const x2 = x * x;
  const x3 = x2 * x;
  const r =
    (2 * x3 - 3 * x2 + 1) * p1.r +
    (x3 - 2 * x2 + x) * h * m1 +
    (-2 * x3 + 3 * x2) * p2.r +
    (x3 - x2) * h * m2;
  return Math.max(MIN_RADIUS, r);
}
