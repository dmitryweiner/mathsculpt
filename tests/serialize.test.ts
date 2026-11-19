// Serializing the state: sanitize, a round trip through JSON.
import { completeState, sanitizeState, stateToParams, paramsToState } from '../src/state/schema';
import { defaultParams } from '../src/geo/build';

describe('sanitizeState', () => {
  it('drops garbage types', () => {
    expect(sanitizeState(null)).toBeNull();
    expect(sanitizeState(42)).toBeNull();
    expect(sanitizeState('x')).toBeNull();
  });

  it('filters unknown profiles, caps and cards', () => {
    const out = sanitizeState({
      profile: 'nope',
      caps: 'weird',
      heightMm: 100,
      displace: { hacker: { on: true }, ripples: { on: true, params: { amp: 0.5, evil: NaN } } },
    });
    expect(out).not.toBeNull();
    expect(out?.profile).toBeUndefined();
    expect(out?.caps).toBeUndefined();
    expect(out?.heightMm).toBe(100);
    expect(out?.displace?.hacker).toBeUndefined();
    expect(out?.displace?.ripples?.params?.amp).toBe(0.5);
    expect(out?.displace?.ripples?.params?.evil).toBeUndefined();
  });

  it('heightMm is clamped to [5, 400]', () => {
    expect(sanitizeState({ heightMm: 9000 })?.heightMm).toBe(400);
    expect(sanitizeState({ heightMm: -3 })?.heightMm).toBe(5);
    expect(sanitizeState({ heightMm: NaN })?.heightMm).toBeUndefined();
  });

  it('wallMm is clamped to [0, 20]', () => {
    expect(sanitizeState({ wallMm: 100 })?.wallMm).toBe(20);
    expect(sanitizeState({ wallMm: -1 })?.wallMm).toBe(0);
    expect(sanitizeState({ wallMm: 2.5 })?.wallMm).toBe(2.5);
    expect(sanitizeState({ wallMm: NaN })?.wallMm).toBeUndefined();
  });
});

describe('stateToParams', () => {
  it('a partial state lies over the defaults', () => {
    const p = stateToParams({
      profile: 'bowl',
      displace: { noise: { on: true, params: { amp: 0.05 } } },
    });
    expect(p.profile).toBe('bowl');
    expect(p.displace.noise.on).toBe(true);
    expect(p.displace.noise.params.amp).toBe(0.05);
    // untouched parameters are the defaults
    expect(p.displace.noise.params.scale).toBe(defaultParams().displace.noise.params.scale);
    expect(p.displace.ripples.on).toBe(true);
  });

  it('foreign parameter keys do not leak through', () => {
    const p = stateToParams({ displace: { ripples: { params: { amp: 0.1, hack: 99 } } } });
    expect(p.displace.ripples.params.amp).toBe(0.1);
    expect(p.displace.ripples.params.hack).toBeUndefined();
  });

  it('clamps parameters to the cards ranges', () => {
    const p = stateToParams({
      displace: {
        ripples: { params: { amp: 999, freqU: -4 } },
        waves: { params: { shape: 999 } },
      },
      deform: { twist: { params: { turns: -99 } } },
      fourier: { r0: 99 },
      profileShape: { neck: -99 },
      shapes: { torus: { R: 99 } },
    });
    expect(p.displace.ripples.params.amp).toBe(0.15);
    expect(p.displace.ripples.params.freqU).toBe(0);
    expect(p.displace.waves.params.shape).toBe(0);
    expect(p.deform.twist.params.turns).toBe(-2);
    expect(p.fourier.r0).toBe(0.6);
    expect(p.profileShape.neck).toBe(-0.6);
    expect(p.shapes.torus.R).toBe(0.5);
  });
});

describe('JSON round-trip', () => {
  it('the state survives JSON and parsing with no loss', () => {
    const params = defaultParams();
    params.profile = 'goblet';
    params.displace.harmonics.on = true;
    params.displace.harmonics.params.l = 7;
    params.deform.twist = { on: true, params: { turns: 0.4 } };
    params.caps = 'bottom';
    const state = paramsToState(params, 150, 3.5);
    const back = completeState(sanitizeState(JSON.parse(JSON.stringify(state))) ?? {});
    expect(back).toEqual(state);
  });

  it('a preset name from old records does not get into the state', () => {
    expect(sanitizeState({ ...paramsToState(defaultParams(), 120, 2), presetName: 'Old' })).not.toHaveProperty('presetName');
  });
});
