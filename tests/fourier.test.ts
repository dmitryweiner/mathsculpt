// Фурье-профиль: формула, кламп, сборка, сериализация.
import { fourierRadius, DEFAULT_FOURIER_PARAMS, FOURIER_PROFILE_ID } from '../src/geo/profiles';
import { buildMesh, defaultParams, radiusFnFor } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';
import { sanitizeState, stateToParams } from '../src/state/schema';

describe('fourierRadius', () => {
  it('r(t) = r0 + Σ aₖ·sin(kπt + φₖ)', () => {
    const p = { r0: 0.3, a1: 0.1, phi1: 0.2, a2: 0.05, phi2: 1, a3: 0.02, phi3: 2 };
    const t = 0.37;
    const expected =
      0.3 +
      0.1 * Math.sin(Math.PI * t + 0.2) +
      0.05 * Math.sin(2 * Math.PI * t + 1) +
      0.02 * Math.sin(3 * Math.PI * t + 2);
    expect(fourierRadius(p, t)).toBeCloseTo(expected, 9);
  });

  it('кламп: не меньше MIN_RADIUS, не больше 1', () => {
    expect(fourierRadius({ r0: -5, a1: 0, a2: 0, a3: 0 }, 0.5)).toBeGreaterThan(0);
    expect(fourierRadius({ r0: 5, a1: 0, a2: 0, a3: 0 }, 0.5)).toBeLessThanOrEqual(1);
  });

  it('пропущенные параметры берутся из дефолтов формулы', () => {
    expect(Number.isFinite(fourierRadius({}, 0.3))).toBe(true);
  });
});

describe('fourier в конвейере', () => {
  it('radiusFnFor переключается на Фурье', () => {
    const p = defaultParams();
    p.profile = FOURIER_PROFILE_ID;
    p.fourier = { ...DEFAULT_FOURIER_PARAMS };
    const prof = radiusFnFor(p);
    expect(prof).not.toBeNull();
    expect(prof?.radiusFn(0.5)).toBeCloseTo(fourierRadius(DEFAULT_FOURIER_PARAMS, 0.5), 9);
  });

  it('строится валидный закрытый меш', () => {
    const p = defaultParams();
    p.profile = FOURIER_PROFILE_ID;
    p.nu = 48;
    p.nv = 48;
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });
});

describe('fourier и mod в состоянии', () => {
  it('sanitize принимает fourier-профиль и параметры', () => {
    const out = sanitizeState({ profile: 'fourier', fourier: { r0: 0.25, a1: 0.2, junk: NaN } });
    expect(out?.profile).toBe('fourier');
    expect(out?.fourier?.r0).toBe(0.25);
    expect(out?.fourier?.junk).toBeUndefined();
  });

  it('stateToParams мержит только известные ключи fourier', () => {
    const p = stateToParams({ fourier: { r0: 0.22, hack: 9 } });
    expect(p.fourier.r0).toBe(0.22);
    expect(p.fourier.hack).toBeUndefined();
    expect(p.fourier.a1).toBe(DEFAULT_FOURIER_PARAMS.a1);
  });

  it('sanitize mod: битые маршруты отбрасываются, LFO чинятся', () => {
    const out = sanitizeState({
      mod: {
        lfos: [{ source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 }, 'garbage'],
        routes: [
          { src: 0, card: 'ripples', param: 'amp', depth: 2 },
          { src: 9, card: 'ripples', param: 'amp', depth: 0.5 },
          { src: 0, card: 'ripples', param: 'nope', depth: 0.5 },
        ],
      },
    });
    expect(out?.mod?.lfos.length).toBe(3);
    expect(out?.mod?.routes.length).toBe(1);
    expect(out?.mod?.routes[0].depth).toBe(1); // кламп depth в [-1,1]
  });

  it('mod проходит через stateToParams', () => {
    const p = stateToParams({
      mod: {
        lfos: [
          { source: 'theta', shape: 'square', rate: 4, phase: 0.5, k: 1 },
          { source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 },
          { source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 },
        ],
        routes: [{ src: 0, card: 'waves', param: 'amp', depth: -0.3 }],
      },
    });
    expect(p.mod.lfos[0].source).toBe('theta');
    expect(p.mod.routes[0].depth).toBe(-0.3);
  });
});
