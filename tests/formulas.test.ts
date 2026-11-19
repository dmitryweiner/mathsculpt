// The UI schema ↔ the core: the cards' ids and the sliders' defaults match
// DEFAULT_*_PARAMS (otherwise the UI and the golden geometry drift apart).
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

describe('the displacement cards schema', () => {
  it('covers every DISPLACE_IDS in the same order', () => {
    expect(DISPLACE_CARDS.map((c) => c.id)).toEqual([...DISPLACE_IDS]);
    for (const c of DISPLACE_CARDS) expect(isDisplaceId(c.id)).toBe(true);
  });

  it.each(DISPLACE_CARDS.map((c) => [c.id, c] as const))('%s: the defaults match the core', (id, card) => {
    if (!isDisplaceId(id)) throw new Error('bad id');
    expect(uiDefaults(card)).toEqual(DEFAULT_DISPLACE_PARAMS[id]);
  });

  it('ranges are sane: min ≤ value ≤ max, step > 0', () => {
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

describe('the deformer cards schema', () => {
  it('covers every DEFORM_IDS in the same order', () => {
    expect(DEFORM_CARDS.map((c) => c.id)).toEqual([...DEFORM_IDS]);
  });

  it.each(DEFORM_CARDS.map((c) => [c.id, c] as const))('%s: the defaults match the core', (id, card) => {
    if (!isDeformId(id)) throw new Error('bad id');
    expect(uiDefaults(card)).toEqual(DEFAULT_DEFORM_PARAMS[id]);
  });
});
