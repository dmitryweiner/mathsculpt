// Схема сериализуемого состояния v1 (URL-хэш, localStorage, пресеты).
// Разбор терпимый: неизвестные/битые поля молча отбрасываются и накрываются
// дефолтами. Без as-кастов — только type guards.

import type { CapMode } from '../geo/surface';
import type { Params } from '../geo/displace';
import { isDisplaceId } from '../geo/displace';
import { isDeformId } from '../geo/deform';
import { isProfileId, FOURIER_PROFILE_ID } from '../geo/profiles';
import { isShapeId } from '../geo/shapes';
import type { BuildParams, CardState } from '../geo/build';
import { defaultParams } from '../geo/build';
import type { ModState, SpatialLfoDef, ModRoute } from '../geo/mod';
import { LFO_COUNT, isLfoShape, isLfoSource, findModTarget, defaultLfo } from '../geo/mod';

export interface CardSnapshot {
  on: boolean;
  params: Params;
}

export interface AppState {
  v: 1;
  presetName?: string;
  profile: string;
  caps: CapMode;
  heightMm: number;
  /** толщина стенки в мм для режима open top (0 = оболочка нулевой толщины) */
  wallMm: number;
  displace: Record<string, CardSnapshot>;
  deform: Record<string, CardSnapshot>;
  fourier?: Params;
  shapes?: Record<string, Params>;
  mod?: ModState;
}

export interface PartialCardSnapshot {
  on?: boolean;
  params?: Params;
}

export interface PartialAppState {
  presetName?: string;
  profile?: string;
  caps?: CapMode;
  heightMm?: number;
  wallMm?: number;
  displace?: Record<string, PartialCardSnapshot>;
  deform?: Record<string, PartialCardSnapshot>;
  fourier?: Params;
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
    if (typeof st.on === 'boolean') snap.on = st.on === true;
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
  if (typeof u.presetName === 'string') out.presetName = u.presetName;
  if (
    typeof u.profile === 'string' &&
    (isProfileId(u.profile) || u.profile === FOURIER_PROFILE_ID || isShapeId(u.profile))
  ) {
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

function applyCards(target: Record<string, CardState>, partial?: Record<string, PartialCardSnapshot>): void {
  if (!partial) return;
  for (const [id, snap] of Object.entries(partial)) {
    const card = target[id];
    if (!card) continue;
    if (typeof snap.on === 'boolean') card.on = snap.on;
    if (snap.params) {
      // только известные ключи: params дефолтов определяют состав
      for (const k of Object.keys(card.params)) {
        const v = snap.params[k];
        if (typeof v === 'number' && Number.isFinite(v)) card.params[k] = v;
      }
    }
  }
}

/** Частичное состояние поверх дефолтов → параметры сборки (без nu/nv из state). */
export function stateToParams(partial: PartialAppState): BuildParams {
  const p = defaultParams();
  if (partial.profile) p.profile = partial.profile;
  if (partial.caps) p.caps = partial.caps;
  applyCards(p.displace, partial.displace);
  applyCards(p.deform, partial.deform);
  if (partial.fourier) {
    for (const k of Object.keys(p.fourier)) {
      const v = partial.fourier[k];
      if (typeof v === 'number' && Number.isFinite(v)) p.fourier[k] = v;
    }
  }
  if (partial.shapes) {
    for (const [id, sp] of Object.entries(partial.shapes)) {
      if (!isShapeId(id)) continue;
      for (const k of Object.keys(p.shapes[id])) {
        const v = sp[k];
        if (typeof v === 'number' && Number.isFinite(v)) p.shapes[id][k] = v;
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
export function paramsToState(p: BuildParams, heightMm: number, wallMm: number, presetName?: string): AppState {
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
  if (presetName) state.presetName = presetName;
  return state;
}
