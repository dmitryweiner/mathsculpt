// Profiles: continuity, positivity, passing through the control points.
import {
  PROFILES,
  profileById,
  profileRadius,
  isProfileId,
  profileShapeFactor,
  shapedProfileRadius,
  DEFAULT_PROFILE_SHAPE,
} from '../src/geo/profiles';
import { buildMesh, defaultParams } from '../src/geo/build';
import { validateMesh } from 'maker-kit/3d/validate';
import { sanitizeState, stateToParams } from '../src/state/schema';

describe('the profiles', () => {
  it.each(PROFILES.map((p) => [p.id] as const))('%s: r(t) is finite and positive', (id) => {
    const def = profileById(id);
    for (let i = 0; i <= 1000; i++) {
      const r = profileRadius(def, i / 1000);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it.each(PROFILES.map((p) => [p.id] as const))('%s: passes through the control points', (id) => {
    const def = profileById(id);
    for (const pt of def.points) {
      expect(profileRadius(def, pt.t)).toBeCloseTo(pt.r, 6);
    }
  });

  it('outside [0,1] — the end values', () => {
    const def = profileById('vase');
    expect(profileRadius(def, -1)).toBeCloseTo(def.points[0].r, 6);
    expect(profileRadius(def, 2)).toBeCloseTo(def.points[def.points.length - 1].r, 6);
  });

  it('isProfileId', () => {
    expect(isProfileId('vase')).toBe(true);
    expect(isProfileId('nope')).toBe(false);
    expect(() => profileById('nope')).toThrow('unknown profile: nope');
  });
});

describe('the profile shape adjustment', () => {
  it('the default (base=belly=neck=0) gives a factor of exactly 1 (the golden geometry holds)', () => {
    for (let i = 0; i <= 20; i++) {
      expect(profileShapeFactor(DEFAULT_PROFILE_SHAPE, i / 20)).toBe(1);
    }
  });

  it('belly widens the middle, hardly touching the ends', () => {
    const p = { base: 0, belly: 0.5, neck: 0 };
    expect(profileShapeFactor(p, 0.5)).toBeCloseTo(1.5, 6); // the belly's peak
    expect(profileShapeFactor(p, 0)).toBeCloseTo(1, 6); // the base
    expect(profileShapeFactor(p, 1)).toBeCloseTo(1, 6); // the neck
  });

  it('base widens the bottom, neck the top', () => {
    expect(profileShapeFactor({ base: 0.4, belly: 0, neck: 0 }, 0)).toBeCloseTo(1.4, 6);
    expect(profileShapeFactor({ base: 0, belly: 0, neck: 0.4 }, 1)).toBeCloseTo(1.4, 6);
    // and they leave the opposite end alone
    expect(profileShapeFactor({ base: 0.4, belly: 0, neck: 0 }, 1)).toBeCloseTo(1, 6);
  });

  it('negative values narrow, the radius stays positive', () => {
    const def = profileById('vase');
    const shape = { base: -0.6, belly: -0.6, neck: -0.6 };
    for (let i = 0; i <= 100; i++) {
      const r = shapedProfileRadius(def, shape, i / 100);
      expect(r).toBeGreaterThan(0);
    }
  });

  it('shapedProfileRadius(default) === profileRadius', () => {
    const def = profileById('amphora');
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      expect(shapedProfileRadius(def, DEFAULT_PROFILE_SHAPE, t)).toBeCloseTo(profileRadius(def, t), 9);
    }
  });
});

describe('the profile shape in the pipeline and the state', () => {
  const build = (shape: Record<string, number>) => {
    const p = defaultParams();
    p.profile = 'vase';
    p.nu = 48;
    p.nv = 48;
    p.displace.ripples.on = false;
    p.profileShape = { base: 0, belly: 0, neck: 0, ...shape };
    return buildMesh(p);
  };

  it('belly>0 widens the vase (the xy bbox and the volume grow), the mesh is valid', () => {
    const plain = validateMesh(build({}));
    const fat = validateMesh(build({ belly: 0.6 }));
    expect(fat.watertight).toBe(true);
    expect(fat.finite).toBe(true);
    const xyPlain = Math.max(plain.bbox.max[0], -plain.bbox.min[0]);
    const xyFat = Math.max(fat.bbox.max[0], -fat.bbox.min[0]);
    expect(xyFat).toBeGreaterThan(xyPlain * 1.1);
    expect(fat.volume).toBeGreaterThan(plain.volume);
  });

  it('neck<0 narrows the neck, the mesh stays valid', () => {
    const r = validateMesh(build({ neck: -0.5 }));
    expect(r.watertight).toBe(true);
    expect(r.finite).toBe(true);
    expect(r.volume).toBeGreaterThan(0);
  });

  it('sanitize/stateToParams: only the known profileShape keys', () => {
    const out = sanitizeState({ profileShape: { belly: 0.5, junk: NaN } });
    expect(out?.profileShape?.belly).toBe(0.5);
    expect(out?.profileShape?.junk).toBeUndefined();
    const p = stateToParams({ profileShape: { belly: 0.3, hack: 9 } });
    expect(p.profileShape.belly).toBe(0.3);
    expect(p.profileShape.hack).toBeUndefined();
    expect(p.profileShape.base).toBe(0);
  });
});
