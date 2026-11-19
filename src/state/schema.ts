// Схема сериализуемого состояния v1 (URL-хэш, localStorage, пресеты).
// Разбор терпимый: неизвестные/битые поля молча отбрасываются и накрываются
// дефолтами. Без as-кастов — только type guards.
//
// Имени пресета в состоянии нет: какой пресет открыт, приложение держит
// рядом (`PresetRef` кита), а `presetName` старых ссылок и пресетов
// отбрасывается при разборе.

import type { CapMode } from '../geo/surface';
import type { Params } from '../geo/displace';
import { isDisplaceId } from '../geo/displace';
import { isDeformId } from '../geo/deform';
import { isProfileId, FOURIER_PROFILE_ID } from '../geo/profiles';
import { isShapeId } from '../geo/shapes';
import type { BuildParams, CardState } from '../geo/build';
import { defaultParams, isRevolveProfile, radiusFnFor } from '../geo/build';
import type { ModState, SpatialLfoDef, ModRoute } from '../geo/mod';
import { LFO_COUNT, isLfoShape, isLfoSource, findModTarget, defaultLfo } from '../geo/mod';
import { DISPLACE_CARDS, DEFORM_CARDS, FOURIER_CARD, PROFILE_SHAPE_CARD, SHAPE_CARDS, clampCardParam } from '../formulas';
import type { CardDef } from '../formulas';

export interface CardSnapshot {
  on: boolean;
  params: Params;
}

export interface AppState {
  v: 1;
  profile: string;
  caps: CapMode;
  heightMm: number;
  /** толщина стенки в мм для режима open top (0 = оболочка нулевой толщины) */
  wallMm: number;
  displace: Record<string, CardSnapshot>;
  deform: Record<string, CardSnapshot>;
  fourier: Params;
  profileShape: Params;
  shapes: Record<string, Params>;
  mod: ModState;
}

export interface PartialCardSnapshot {
  on?: boolean;
  params?: Params;
}

export interface PartialAppState {
  profile?: string;
  caps?: CapMode;
  heightMm?: number;
  wallMm?: number;
  displace?: Record<string, PartialCardSnapshot>;
  deform?: Record<string, PartialCardSnapshot>;
  fourier?: Params;
  profileShape?: Params;
  shapes?: Record<string, Params>;
  mod?: ModState;
}

export const DEFAULT_HEIGHT_MM = 120;
export const DEFAULT_WALL_MM = 2;

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === 'object' && u !== null;
}

function toParams(u: unknown): Params | undefined {
  if (!isRecord(u)) return undefined;
  const out: Params = {};
  for (const [k, v] of Object.entries(u)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function isCapMode(v: unknown): v is CapMode {
  return v === 'both' || v === 'bottom' || v === 'none';
}

function sanitizeCards(u: unknown, isId: (k: string) => boolean): Record<string, PartialCardSnapshot> | undefined {
  if (!isRecord(u)) return undefined;
  const out: Record<string, PartialCardSnapshot> = {};
  for (const [id, st] of Object.entries(u)) {
    if (!isId(id) || !isRecord(st)) continue;
    const snap: PartialCardSnapshot = {};
    if (typeof st.on === 'boolean') snap.on = st.on;
    const params = toParams(st.params);
    if (params) snap.params = params;
    out[id] = snap;
  }
  return out;
}

function sanitizeLfo(u: unknown): SpatialLfoDef | null {
  if (!isRecord(u)) return null;
  const { source, shape, rate, phase, k } = u;
  if (!isLfoSource(source) || !isLfoShape(shape)) return null;
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
  if (typeof phase !== 'number' || !Number.isFinite(phase)) return null;
  const kk = typeof k === 'number' && Number.isFinite(k) ? k : 1;
  return { source, shape, rate, phase, k: kk };
}

function sanitizeRoute(u: unknown, lfoCount: number): ModRoute | null {
  if (!isRecord(u)) return null;
  const { src, card, param, depth } = u;
  if (typeof src !== 'number' || !Number.isInteger(src) || src < 0 || src >= lfoCount) return null;
  if (typeof card !== 'string' || typeof param !== 'string') return null;
  if (!findModTarget(card, param)) return null;
  if (typeof depth !== 'number' || !Number.isFinite(depth)) return null;
  return { src, card, param, depth: Math.max(-1, Math.min(1, depth)) };
}

// Маршруты ссылаются на LFO по индексу (src): битый LFO заменяется дефолтным
// (не выкидывается — иначе сдвинулись бы индексы), негодные маршруты
// отбрасываются поштучно. Пул добивается/обрезается до LFO_COUNT.
function sanitizeMod(u: unknown): ModState | undefined {
  if (!isRecord(u)) return undefined;
  if (!Array.isArray(u.lfos) || !Array.isArray(u.routes)) return undefined;
  const lfos: SpatialLfoDef[] = [];
  for (let i = 0; i < LFO_COUNT; i++) {
    lfos.push(sanitizeLfo(u.lfos[i]) ?? defaultLfo());
  }
  const routes: ModRoute[] = [];
  for (const raw of u.routes) {
    const route = sanitizeRoute(raw, lfos.length);
    if (route) routes.push(route);
  }
  return { lfos, routes };
}

/** Терпимый разбор состояния из JSON (URL, localStorage, пресеты). */
export function sanitizeState(u: unknown): PartialAppState | null {
  if (!isRecord(u)) return null;
  const out: PartialAppState = {};
  if (typeof u.profile === 'string' && (isProfileId(u.profile) || u.profile === FOURIER_PROFILE_ID || isShapeId(u.profile))) {
    out.profile = u.profile;
  }
  if (isCapMode(u.caps)) out.caps = u.caps;
  if (typeof u.heightMm === 'number' && Number.isFinite(u.heightMm)) {
    out.heightMm = Math.min(400, Math.max(5, u.heightMm));
  }
  if (typeof u.wallMm === 'number' && Number.isFinite(u.wallMm)) {
    out.wallMm = Math.min(20, Math.max(0, u.wallMm));
  }
  const displace = sanitizeCards(u.displace, isDisplaceId);
  if (displace) out.displace = displace;
  const deform = sanitizeCards(u.deform, isDeformId);
  if (deform) out.deform = deform;
  const fourier = toParams(u.fourier);
  if (fourier) out.fourier = fourier;
  const profileShape = toParams(u.profileShape);
  if (profileShape) out.profileShape = profileShape;
  if (isRecord(u.shapes)) {
    const shapes: Record<string, Params> = {};
    for (const [id, sp] of Object.entries(u.shapes)) {
      if (!isShapeId(id)) continue;
      const params = toParams(sp);
      if (params) shapes[id] = params;
    }
    out.shapes = shapes;
  }
  const mod = sanitizeMod(u.mod);
  if (mod) out.mod = mod;
  return out;
}

function applyCards(target: Record<string, CardState>, defs: readonly CardDef[], partial?: Record<string, PartialCardSnapshot>): void {
  if (!partial) return;
  for (const [id, snap] of Object.entries(partial)) {
    const card = target[id];
    if (!card) continue;
    if (typeof snap.on === 'boolean') card.on = snap.on;
    if (snap.params) {
      for (const k of Object.keys(card.params)) {
        const v = snap.params[k];
        const def = defs.find((candidate) => candidate.id === id);
        if (!def || typeof v !== 'number') continue;
        const safe = clampCardParam(def, k, v);
        if (safe !== undefined) card.params[k] = safe;
      }
    }
  }
}

/** Частичное состояние поверх дефолтов → параметры сборки (без nu/nv из state). */
export function stateToParams(partial: PartialAppState): BuildParams {
  const p = defaultParams();
  if (partial.profile) p.profile = partial.profile;
  if (partial.caps) p.caps = partial.caps;
  applyCards(p.displace, DISPLACE_CARDS, partial.displace);
  applyCards(p.deform, DEFORM_CARDS, partial.deform);
  if (partial.fourier) {
    for (const k of Object.keys(p.fourier)) {
      const v = partial.fourier[k];
      if (typeof v !== 'number') continue;
      const safe = clampCardParam(FOURIER_CARD, k, v);
      if (safe !== undefined) p.fourier[k] = safe;
    }
  }
  if (partial.profileShape) {
    for (const k of Object.keys(p.profileShape)) {
      const v = partial.profileShape[k];
      if (typeof v !== 'number') continue;
      const safe = clampCardParam(PROFILE_SHAPE_CARD, k, v);
      if (safe !== undefined) p.profileShape[k] = safe;
    }
  }
  if (partial.shapes) {
    for (const [id, sp] of Object.entries(partial.shapes)) {
      if (!isShapeId(id)) continue;
      const def = SHAPE_CARDS.find((candidate) => candidate.id === id);
      if (!def) continue;
      for (const k of Object.keys(p.shapes[id])) {
        const v = sp[k];
        if (typeof v !== 'number') continue;
        const safe = clampCardParam(def, k, v);
        if (safe !== undefined) p.shapes[id][k] = safe;
      }
    }
  }
  if (partial.mod) {
    p.mod = {
      lfos: partial.mod.lfos.map((l) => ({ ...l })),
      routes: partial.mod.routes.map((r) => ({ ...r })),
    };
  }
  return p;
}

/** Полное состояние из параметров сборки (для share/сохранения). */
export function paramsToState(p: BuildParams, heightMm: number, wallMm: number): AppState {
  const cards = (src: Record<string, CardState>): Record<string, CardSnapshot> => {
    const out: Record<string, CardSnapshot> = {};
    for (const [id, card] of Object.entries(src)) {
      out[id] = { on: card.on, params: { ...card.params } };
    }
    return out;
  };
  const state: AppState = {
    v: 1,
    profile: p.profile,
    caps: p.caps,
    heightMm,
    wallMm,
    displace: cards(p.displace),
    deform: cards(p.deform),
    fourier: { ...p.fourier },
    profileShape: { ...p.profileShape },
    shapes: {
      sphere: { ...p.shapes.sphere },
      torus: { ...p.shapes.torus },
      superellipsoid: { ...p.shapes.superellipsoid },
      supershape: { ...p.shapes.supershape },
    },
    mod: {
      lfos: p.mod.lfos.map((l) => ({ ...l })),
      routes: p.mod.routes.map((r) => ({ ...r })),
    },
  };
  return state;
}

/**
 * Параметры сборки из состояния (сетку nu×nv задаёт тот, кто строит).
 * Ядро считает в относительных единицах, поэтому стенка из миллиметров
 * переводится здесь: 1 ед. модели = heightMm/modelHeight мм, значит
 * wall = wallMm · modelHeight / heightMm. Стенка — только у тела вращения
 * с открытым верхом; иначе 0 (сплошная модель или оболочка).
 */
export function buildParamsOf(state: AppState): BuildParams {
  const params = stateToParams(state);
  if (params.caps === 'bottom' && state.wallMm > 0 && isRevolveProfile(params.profile)) {
    const modelHeight = radiusFnFor(params)?.height ?? 1;
    params.wall = (state.wallMm * modelHeight) / state.heightMm;
  }
  return params;
}

/** Полное состояние из частичного: дефолты под тем, что задано. */
export function completeState(partial: PartialAppState): AppState {
  return paramsToState(stateToParams(partial), partial.heightMm ?? DEFAULT_HEIGHT_MM, partial.wallMm ?? DEFAULT_WALL_MM);
}

/** Модель по умолчанию. */
export function defaultState(): AppState {
  return completeState({});
}

/** Полное чистое состояние из чего угодно (хранилище, файл): мусор — модель по умолчанию. */
export function cleanState(u: unknown): AppState {
  return completeState(sanitizeState(u) ?? {});
}
