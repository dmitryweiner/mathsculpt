// UI-схема ↔ ядро: id карточек и дефолты слайдеров совпадают с
// DEFAULT_*_PARAMS (иначе UI и golden-геометрия разъедутся).
import { DISPLACE_CARDS, DEFORM_CARDS } from '../src/formulas';
import type { CardDef } from '../src/formulas';
import { DISPLACE_IDS, DEFAULT_DISPLACE_PARAMS, isDisplaceId } from '../src/geo/displace';
import type { Params } from '../src/geo/displace';
import { DEFORM_IDS, DEFAULT_DEFORM_PARAMS, isDeformId } from '../src/geo/deform';

function uiDefaults(card: CardDef): Params {
  const out: Params = {};
  for (const s of card.sliders) out[s.k] = s.value;
  for (const s of card.selects ?? []) out[s.k] = s.value;
  return out;
}

describe('схема карточек смещений', () => {
  it('покрывает все DISPLACE_IDS в том же порядке', () => {
    expect(DISPLACE_CARDS.map((c) => c.id)).toEqual([...DISPLACE_IDS]);
    for (const c of DISPLACE_CARDS) expect(isDisplaceId(c.id)).toBe(true);
  });

  it.each(DISPLACE_CARDS.map((c) => [c.id, c] as const))('%s: дефолты совпадают с ядром', (id, card) => {
    if (!isDisplaceId(id)) throw new Error('bad id');
    expect(uiDefaults(card)).toEqual(DEFAULT_DISPLACE_PARAMS[id]);
  });

  it('диапазоны корректны: min ≤ value ≤ max, step > 0', () => {
    for (const card of [...DISPLACE_CARDS, ...DEFORM_CARDS]) {
      for (const s of card.sliders) {
        expect(s.min).toBeLessThan(s.max);
        expect(s.step).toBeGreaterThan(0);
        expect(s.value).toBeGreaterThanOrEqual(s.min);
        expect(s.value).toBeLessThanOrEqual(s.max);
      }
      for (const sel of card.selects ?? []) {
        expect(sel.options.some((o) => o.v === sel.value)).toBe(true);
      }
    }
  });
});

describe('схема карточек деформеров', () => {
  it('покрывает все DEFORM_IDS в том же порядке', () => {
    expect(DEFORM_CARDS.map((c) => c.id)).toEqual([...DEFORM_IDS]);
  });

  it.each(DEFORM_CARDS.map((c) => [c.id, c] as const))('%s: дефолты совпадают с ядром', (id, card) => {
    if (!isDeformId(id)) throw new Error('bad id');
    expect(uiDefaults(card)).toEqual(DEFAULT_DEFORM_PARAMS[id]);
  });
});
