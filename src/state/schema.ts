// Схема сериализуемого состояния v1 (URL-хэш, localStorage, пресеты).
// Разбор терпимый: неизвестные/битые поля молча отбрасываются и накрываются
// дефолтами. Без as-кастов — только type guards.

import type { CapMode } from '../geo/surface';
import type { Params } from '../geo/displace';
import { isDisplaceId } from '../geo/displace';
import { isDeformId } from '../geo/deform';
import { isProfileId } from '../geo/profiles';
import type { BuildParams, CardState } from '../geo/build';
import { defaultParams } from '../geo/build';

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
  displace: Record<string, CardSnapshot>;
  deform: Record<string, CardSnapshot>;
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
  displace?: Record<string, PartialCardSnapshot>;
  deform?: Record<string, PartialCardSnapshot>;
}

export const DEFAULT_HEIGHT_MM = 120;

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

/** Терпимый разбор состояния из JSON (URL, localStorage, пресеты). */
export function sanitizeState(u: unknown): PartialAppState | null {
  if (!isRecord(u)) return null;
  const out: PartialAppState = {};
  if (typeof u.presetName === 'string') out.presetName = u.presetName;
  if (typeof u.profile === 'string' && isProfileId(u.profile)) out.profile = u.profile;
  if (isCapMode(u.caps)) out.caps = u.caps;
  if (typeof u.heightMm === 'number' && Number.isFinite(u.heightMm)) {
    out.heightMm = Math.min(400, Math.max(5, u.heightMm));
  }
  const displace = sanitizeCards(u.displace, isDisplaceId);
  if (displace) out.displace = displace;
  const deform = sanitizeCards(u.deform, isDeformId);
  if (deform) out.deform = deform;
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
  return p;
}

/** Полное состояние из параметров сборки (для share/сохранения). */
export function paramsToState(p: BuildParams, heightMm: number, presetName?: string): AppState {
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
    displace: cards(p.displace),
    deform: cards(p.deform),
  };
  if (presetName) state.presetName = presetName;
  return state;
}
