// State → build parameters: the wall is converted from millimetres to
// relative model units (the core works in them), for a hollow solid of
// revolution only.
import { buildParamsOf, defaultState } from '../src/state/schema';
import { radiusFnFor } from '../src/geo/build';

describe('buildParamsOf', () => {
  it('a solid model has no wall', () => {
    expect(buildParamsOf({ ...defaultState(), caps: 'both', wallMm: 3 }).wall).toBe(0);
  });

  it('the open top of a solid of revolution: the wall in mm → model units', () => {
    const state = { ...defaultState(), profile: 'vase', caps: 'bottom' as const, wallMm: 3, heightMm: 150 };
    const params = buildParamsOf(state);
    const modelHeight = radiusFnFor(params)?.height ?? NaN;
    expect(params.wall).toBeCloseTo((3 * modelHeight) / 150, 12);
  });

  it('a zero wall is a shell', () => {
    expect(buildParamsOf({ ...defaultState(), caps: 'bottom', wallMm: 0 }).wall).toBe(0);
  });

  it('shapes have no wall', () => {
    expect(buildParamsOf({ ...defaultState(), profile: 'sphere', caps: 'bottom', wallMm: 3 }).wall).toBe(0);
  });

  it('the cards, the profile and the modulation come from the state', () => {
    const base = defaultState();
    const state = {
      ...base,
      profile: 'goblet',
      displace: { ...base.displace, noise: { on: true, params: { amp: 0.05, scale: 3, octaves: 3, seed: 1 } } },
    };
    const params = buildParamsOf(state);
    expect(params.profile).toBe('goblet');
    expect(params.displace.noise).toEqual({ on: true, params: { amp: 0.05, scale: 3, octaves: 3, seed: 1 } });
  });
});
