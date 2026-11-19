// The panel's rows — data for the kit's controls (`maker-kit/ui/controls`):
// where each reads its value in the state and what new state it gives. The
// state is immutable: an edit returns a new one, the old one stays in the
// history. No DOM — tested in node; `ui/panel` draws them.

import type { Control, Option } from 'maker-kit/ui/controls';
import { labelText } from 'maker-kit/core/message';
import type { Translate } from 'maker-kit/core/message';
import type { CardDef } from '../formulas';
import { findParameterCard } from '../formulas';
import type { Params } from '../geo/displace';
import { isDeformId } from '../geo/deform';
import { isRevolveProfile } from '../geo/build';
import type { LfoShape, LfoSource, ModRoute, SpatialLfoDef } from '../geo/mod';
import { LFO_COUNT, LFO_SHAPES, LFO_SOURCES, MOD_TARGETS } from '../geo/mod';
import { FOURIER_PROFILE_ID, PROFILE_IDS } from '../geo/profiles';
import { SHAPE_IDS } from '../geo/shapes';
import type { AppState, CardSnapshot } from '../state/schema';
import type { Key } from '../i18n';
import { hasKey } from '../i18n';

export type Row = Control<AppState, Key>;

/** Where a card's parameters live in the state. */
interface Slot {
  read(state: AppState): Params;
  write(state: AppState, params: Params): AppState;
}

type EffectGroup = 'displace' | 'deform';

const snapshot = (state: AppState, group: EffectGroup, id: string): CardSnapshot => state[group][id] ?? { on: false, params: {} };

function effectSlot(group: EffectGroup, id: string): Slot {
  return {
    read: (state) => snapshot(state, group, id).params,
    write: (state, params) => ({ ...state, [group]: { ...state[group], [id]: { ...snapshot(state, group, id), params } } }),
  };
}

function rowsOf(def: CardDef, slot: Slot): Row[] {
  const rows: Row[] = [];
  for (const sel of def.selects ?? []) {
    rows.push({
      kind: 'select',
      key: sel.k,
      label: sel.label,
      options: sel.options.map((option) => ({ value: String(option.v), label: option.label })),
      get: (state) => String(slot.read(state)[sel.k] ?? sel.value),
      set: (state, value) => slot.write(state, { ...slot.read(state), [sel.k]: Number(value) }),
    });
  }
  for (const slider of def.sliders) {
    rows.push({
      kind: 'range',
      key: slider.k,
      label: slider.label,
      min: slider.min,
      max: slider.max,
      step: slider.step,
      get: (state) => slot.read(state)[slider.k] ?? slider.value,
      set: (state, value) => slot.write(state, { ...slot.read(state), [slider.k]: value }),
    });
  }
  return rows;
}

/** A displacement or deformer card: the switch as the first row, then its parameters. */
export function effectRows(def: CardDef): Row[] {
  const group: EffectGroup = isDeformId(def.id) ? 'deform' : 'displace';
  return [
    {
      kind: 'check',
      key: 'on',
      label: 'card.on',
      get: (state) => snapshot(state, group, def.id).on,
      set: (state, on) => ({ ...state, [group]: { ...state[group], [def.id]: { ...snapshot(state, group, def.id), on } } }),
    },
    ...rowsOf(def, effectSlot(group, def.id)),
  ];
}

/** A carrier card — the profile shape, the Fourier profile, a shape: always on, parameters only. */
export function carrierRows(def: CardDef): Row[] {
  if (def.id === 'profileShape') {
    return rowsOf(def, { read: (state) => state.profileShape, write: (state, profileShape) => ({ ...state, profileShape }) });
  }
  if (def.id === FOURIER_PROFILE_ID) {
    return rowsOf(def, { read: (state) => state.fourier, write: (state, fourier) => ({ ...state, fourier }) });
  }
  return rowsOf(def, {
    read: (state) => state.shapes[def.id] ?? {},
    write: (state, params) => ({ ...state, shapes: { ...state.shapes, [def.id]: params } }),
  });
}

const PROFILE_OPTIONS: readonly Option<Key>[] = [...PROFILE_IDS, FOURIER_PROFILE_ID, ...SHAPE_IDS].map((id) => {
  const key = `profile.${id}`;
  return hasKey(key) ? { value: id, label: key } : { value: id, text: id };
});

/** The Shape card: the carrier, the mode, a hollow vessel's wall, the height. */
export const SHAPE_ROWS: readonly Row[] = [
  {
    kind: 'select',
    key: 'profile',
    label: 'shape.profile',
    options: PROFILE_OPTIONS,
    get: (state) => state.profile,
    set: (state, profile) => ({ ...state, profile }),
  },
  {
    kind: 'select',
    key: 'caps',
    label: 'shape.mode',
    options: [
      { value: 'both', label: 'shape.mode.both' },
      { value: 'bottom', label: 'shape.mode.bottom' },
    ],
    get: (state) => (state.caps === 'bottom' ? 'bottom' : 'both'),
    set: (state, caps) => ({ ...state, caps: caps === 'bottom' ? 'bottom' : 'both' }),
  },
  {
    kind: 'range',
    key: 'wall',
    label: 'shape.wall',
    hint: 'shape.wall.hint',
    min: 0,
    max: 8,
    step: 0.2,
    unit: 'unit.mm',
    when: (state) => state.caps === 'bottom' && isRevolveProfile(state.profile),
    get: (state) => state.wallMm,
    set: (state, wallMm) => ({ ...state, wallMm }),
  },
  {
    kind: 'range',
    key: 'height',
    label: 'shape.height',
    min: 5,
    max: 400,
    step: 1,
    unit: 'unit.mm',
    get: (state) => state.heightMm,
    set: (state, heightMm) => ({ ...state, heightMm }),
  },
];

const SOURCE_LABELS: Readonly<Record<LfoSource, Key>> = {
  z: 'lfo.source.z',
  theta: 'lfo.source.theta',
  spiral: 'lfo.source.spiral',
  radius: 'lfo.source.radius',
  dist: 'lfo.source.dist',
};

const SHAPE_LABELS: Readonly<Record<LfoShape, Key>> = {
  sine: 'lfo.shape.sine',
  triangle: 'lfo.shape.triangle',
  saw: 'lfo.shape.saw',
  square: 'lfo.shape.square',
  random: 'lfo.shape.random',
};

function withLfo(state: AppState, index: number, change: (lfo: SpatialLfoDef) => SpatialLfoDef): AppState {
  return { ...state, mod: { ...state.mod, lfos: state.mod.lfos.map((lfo, i) => (i === index ? change(lfo) : lfo)) } };
}

/** The rows of the pool's LFO number `index`. */
export function lfoRows(index: number): Row[] {
  const lfo = (state: AppState): SpatialLfoDef | undefined => state.mod.lfos[index];
  const range = (key: 'rate' | 'phase' | 'k', label: Key, min: number, max: number, step: number): Row => ({
    kind: 'range',
    key,
    label,
    min,
    max,
    step,
    get: (state) => lfo(state)?.[key] ?? 0,
    set: (state, value) => withLfo(state, index, (l) => ({ ...l, [key]: value })),
  });
  return [
    {
      kind: 'select',
      key: 'source',
      label: 'lfo.source',
      options: LFO_SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] })),
      get: (state) => lfo(state)?.source ?? 'z',
      set: (state, value) => withLfo(state, index, (l) => ({ ...l, source: LFO_SOURCES.find((s) => s === value) ?? l.source })),
    },
    {
      kind: 'select',
      key: 'shape',
      label: 'lfo.shape',
      options: LFO_SHAPES.map((value) => ({ value, label: SHAPE_LABELS[value] })),
      get: (state) => lfo(state)?.shape ?? 'sine',
      set: (state, value) => withLfo(state, index, (l) => ({ ...l, shape: LFO_SHAPES.find((s) => s === value) ?? l.shape })),
    },
    range('rate', 'lfo.rate', 0, 16, 0.25),
    range('phase', 'lfo.phase', 0, 1, 0.01),
    { ...range('k', 'lfo.k', -8, 8, 1), when: (state) => lfo(state)?.source === 'spiral' },
  ];
}

function withRoute(state: AppState, index: number, change: (route: ModRoute) => ModRoute): AppState {
  return { ...state, mod: { ...state.mod, routes: state.mod.routes.map((route, i) => (i === index ? change(route) : route)) } };
}

/** A modulation target in words: "Ripples · Amplitude". */
export function targetText(card: string, param: string, t: Translate<Key>): string {
  const def = findParameterCard(card);
  const slider = def?.sliders.find((s) => s.k === param);
  return `${def ? t(def.title) : card} · ${slider ? labelText(slider.label, t) : param}`;
}

/** The rows of route number `index`: the source, the target, the depth. The targets' labels come from the dictionary — `t`. */
export function routeRows(index: number, t: Translate<Key>): Row[] {
  const route = (state: AppState): ModRoute | undefined => state.mod.routes[index];
  return [
    {
      kind: 'select',
      key: 'src',
      label: 'mod.route.src',
      options: Array.from({ length: LFO_COUNT }, (_, i) => ({ value: String(i), text: t('lfo.title', { n: i + 1 }) })),
      get: (state) => String(route(state)?.src ?? 0),
      set: (state, value) => withRoute(state, index, (r) => ({ ...r, src: Number(value) })),
    },
    {
      kind: 'select',
      key: 'target',
      label: 'mod.route.target',
      options: MOD_TARGETS.map((target) => ({ value: `${target.card}.${target.param}`, text: targetText(target.card, target.param, t) })),
      get: (state) => {
        const r = route(state);
        return r ? `${r.card}.${r.param}` : '';
      },
      set: (state, value) => {
        const target = MOD_TARGETS.find((m) => `${m.card}.${m.param}` === value);
        return target ? withRoute(state, index, (r) => ({ ...r, card: target.card, param: target.param })) : state;
      },
    },
    {
      kind: 'range',
      key: 'depth',
      label: 'mod.route.depth',
      min: -1,
      max: 1,
      step: 0.01,
      get: (state) => route(state)?.depth ?? 0,
      set: (state, depth) => withRoute(state, index, (r) => ({ ...r, depth })),
    },
  ];
}
