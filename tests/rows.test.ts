// Строки панели — данные для контролов кита: что каждая читает из
// состояния и какое новое состояние даёт. Состояние неизменяемо: правка
// возвращает новое и не трогает старое.
import { DISPLACE_CARDS, DEFORM_CARDS, FOURIER_CARD, PROFILE_SHAPE_CARD, SHAPE_CARDS } from '../src/formulas';
import { MOD_TARGETS, LFO_COUNT } from '../src/geo/mod';
import { PROFILE_IDS, FOURIER_PROFILE_ID } from '../src/geo/profiles';
import { SHAPE_IDS } from '../src/geo/shapes';
import { defaultState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { carrierRows, effectRows, lfoRows, routeRows, SHAPE_ROWS } from '../src/ui/rows';
import type { Row } from '../src/ui/rows';
import { t } from '../src/i18n';

function row(rows: readonly Row[], key: string): Row {
  const found = rows.find((r) => r.key === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
}

function setNumber(r: Row, state: AppState, value: number): AppState {
  if (r.kind !== 'range') throw new Error(`${r.key} is ${r.kind}`);
  return r.set(state, value);
}

function getNumber(r: Row, state: AppState): number {
  if (r.kind !== 'range') throw new Error(`${r.key} is ${r.kind}`);
  return r.get(state);
}

function setString(r: Row, state: AppState, value: string): AppState {
  if (r.kind !== 'select') throw new Error(`${r.key} is ${r.kind}`);
  return r.set(state, value);
}

function shown(r: Row, state: AppState): boolean {
  return r.when ? r.when(state) : true;
}

describe('строки карточек эффектов', () => {
  it.each([...DISPLACE_CARDS, ...DEFORM_CARDS].map((def) => [def.id, def] as const))(
    '%s: галочка, затем селекты и ползунки схемы',
    (_id, def) => {
      const rows = effectRows(def);
      expect(rows.map((r) => r.key)).toEqual(['on', ...(def.selects ?? []).map((s) => s.k), ...def.sliders.map((s) => s.k)]);
      for (const s of def.sliders) {
        const r = row(rows, s.k);
        expect(r.kind === 'range' && [r.min, r.max, r.step]).toEqual([s.min, s.max, s.step]);
      }
    },
  );

  it('галочка включает карточку, не трогая остальное', () => {
    const before = defaultState();
    const on = row(effectRows(DEFORM_CARDS[0]), 'on');
    if (on.kind !== 'check') throw new Error('not a check');
    const after = on.set(before, true);
    expect(after.deform[DEFORM_CARDS[0].id]?.on).toBe(true);
    expect(before.deform[DEFORM_CARDS[0].id]?.on).toBe(false);
    expect(after.displace).toBe(before.displace);
  });

  it('ползунок меняет свой параметр и только его', () => {
    const before = defaultState();
    const after = setNumber(row(effectRows(DISPLACE_CARDS[0]), 'amp'), before, 0.07);
    expect(after.displace.ripples?.params.amp).toBe(0.07);
    expect(after.displace.ripples?.params.freqU).toBe(before.displace.ripples?.params.freqU);
    expect(after.displace.ripples?.on).toBe(before.displace.ripples?.on);
    expect(before.displace.ripples?.params.amp).toBe(0.02);
    expect(after.deform).toBe(before.deform);
  });

  it('селект хранит число, показывает строку', () => {
    const waves = DISPLACE_CARDS.find((d) => d.id === 'waves');
    if (!waves) throw new Error('no waves');
    const shape = row(effectRows(waves), 'shape');
    const after = setString(shape, defaultState(), '2');
    expect(after.displace.waves?.params.shape).toBe(2);
    expect(shape.kind === 'select' && shape.get(after)).toBe('2');
  });
});

describe('карточки носителя', () => {
  it('без галочки; правят свои параметры', () => {
    for (const def of [PROFILE_SHAPE_CARD, FOURIER_CARD, ...SHAPE_CARDS]) {
      expect(carrierRows(def).map((r) => r.key)).toEqual(def.sliders.map((s) => s.k));
    }
    const s0 = defaultState();
    expect(setNumber(row(carrierRows(FOURIER_CARD), 'r0'), s0, 0.4).fourier.r0).toBe(0.4);
    expect(setNumber(row(carrierRows(PROFILE_SHAPE_CARD), 'belly'), s0, 0.6).profileShape.belly).toBe(0.6);
    const torus = SHAPE_CARDS.find((d) => d.id === 'torus');
    if (!torus) throw new Error('no torus');
    const after = setNumber(row(carrierRows(torus), 'R'), s0, 0.4);
    expect(after.shapes.torus?.R).toBe(0.4);
    expect(after.shapes.sphere).toBe(s0.shapes.sphere);
  });
});

describe('строки «Shape»', () => {
  it('профиль: все профили, Фурье и фигуры', () => {
    const profile = row(SHAPE_ROWS, 'profile');
    if (profile.kind !== 'select' || typeof profile.options === 'function') throw new Error('profile');
    expect(profile.options.map((o) => o.value)).toEqual([...PROFILE_IDS, FOURIER_PROFILE_ID, ...SHAPE_IDS]);
    expect(setString(profile, defaultState(), 'torus').profile).toBe('torus');
  });

  it('стенка видна только у полого тела вращения', () => {
    const wall = row(SHAPE_ROWS, 'wall');
    const s0 = defaultState();
    expect(shown(wall, { ...s0, caps: 'both' })).toBe(false);
    expect(shown(wall, { ...s0, caps: 'bottom', profile: 'vase' })).toBe(true);
    expect(shown(wall, { ...s0, caps: 'bottom', profile: 'torus' })).toBe(false);
    expect(setNumber(wall, s0, 3.4).wallMm).toBe(3.4);
  });

  it('режим и высота', () => {
    const s0 = defaultState();
    expect(setString(row(SHAPE_ROWS, 'caps'), s0, 'bottom').caps).toBe('bottom');
    const height = row(SHAPE_ROWS, 'height');
    expect(height.kind === 'range' && [height.min, height.max, height.unit]).toEqual([5, 400, 'unit.mm']);
    expect(getNumber(height, setNumber(height, s0, 150))).toBe(150);
  });
});

describe('модуляция', () => {
  it('строки LFO правят свой LFO; k — только у спирали', () => {
    const s0 = defaultState();
    const rows = lfoRows(1);
    const after = setNumber(row(rows, 'rate'), s0, 4);
    expect(after.mod.lfos[1]?.rate).toBe(4);
    expect(after.mod.lfos[0]).toBe(s0.mod.lfos[0]);
    const k = row(rows, 'k');
    expect(shown(k, s0)).toBe(s0.mod.lfos[1]?.source === 'spiral');
    expect(shown(k, setString(row(rows, 'source'), s0, 'spiral'))).toBe(true);
    expect(LFO_COUNT).toBe(s0.mod.lfos.length);
  });

  it('строки маршрута: источник, цель из MOD_TARGETS, глубина', () => {
    const base = defaultState();
    const s0 = { ...base, mod: { ...base.mod, routes: [{ src: 0, card: 'ripples', param: 'amp', depth: 0.5 }] } };
    const rows = routeRows(0, t);
    const target = row(rows, 'target');
    if (target.kind !== 'select' || typeof target.options === 'function') throw new Error('target');
    expect(target.options.map((o) => o.value)).toEqual(MOD_TARGETS.map((m) => `${m.card}.${m.param}`));
    const moved = setString(target, s0, 'twist.turns');
    expect(moved.mod.routes[0]).toEqual({ src: 0, card: 'twist', param: 'turns', depth: 0.5 });
    expect(setString(row(rows, 'src'), s0, '2').mod.routes[0]?.src).toBe(2);
    expect(setNumber(row(rows, 'depth'), s0, -0.3).mod.routes[0]?.depth).toBe(-0.3);
    expect(s0.mod.routes[0]?.depth).toBe(0.5);
  });
});
