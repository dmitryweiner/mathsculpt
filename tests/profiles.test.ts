// Профили: непрерывность, положительность, прохождение через контрольные точки.
import { PROFILES, profileById, profileRadius, isProfileId } from '../src/geo/profiles';

describe('профили-пресеты', () => {
  it.each(PROFILES.map((p) => [p.id] as const))('%s: r(t) конечен и положителен', (id) => {
    const def = profileById(id);
    for (let i = 0; i <= 1000; i++) {
      const r = profileRadius(def, i / 1000);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it.each(PROFILES.map((p) => [p.id] as const))('%s: проходит через контрольные точки', (id) => {
    const def = profileById(id);
    for (const pt of def.points) {
      expect(profileRadius(def, pt.t)).toBeCloseTo(pt.r, 6);
    }
  });

  it('вне [0,1] — крайние значения', () => {
    const def = profileById('vase');
    expect(profileRadius(def, -1)).toBeCloseTo(def.points[0].r, 6);
    expect(profileRadius(def, 2)).toBeCloseTo(def.points[def.points.length - 1].r, 6);
  });

  it('isProfileId', () => {
    expect(isProfileId('vase')).toBe(true);
    expect(isProfileId('nope')).toBe(false);
    expect(() => profileById('nope')).toThrow();
  });
});
