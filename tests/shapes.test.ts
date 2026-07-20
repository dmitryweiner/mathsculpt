// Фигуры-носители: сфера, тор, суперэллипсоид, supershape — валидность,
// объёмы, нормировка, сериализация.
import { buildMesh, defaultParams } from '../src/geo/build';
import { SHAPE_IDS, superformula, shapeGrid, DEFAULT_SHAPE_PARAMS } from '../src/geo/shapes';
import { validateMesh } from '../src/geo/validate';
import { sanitizeState, stateToParams } from '../src/state/schema';

function shapeParams(id: string, withRipples = true) {
  const p = defaultParams();
  p.profile = id;
  p.nu = 48;
  p.nv = 48;
  p.displace.ripples.on = withRipples;
  return p;
}

describe('фигуры: свойства меша', () => {
  it.each(SHAPE_IDS.flatMap((id) => [[id, false] as const, [id, true] as const]))(
    '%s (ripples=%s): закрытый валидный меш',
    (id, ripples) => {
      const report = validateMesh(buildMesh(shapeParams(id, ripples)));
      expect(report.finite).toBe(true);
      expect(report.watertight).toBe(true);
      expect(report.volume).toBeGreaterThan(0);
    },
  );

  it('сфера: объём ≈ 4/3·π·R³ (R=0.5)', () => {
    const report = validateMesh(buildMesh(shapeParams('sphere', false)));
    const exact = (4 / 3) * Math.PI * 0.5 ** 3;
    expect(report.volume).toBeGreaterThan(exact * 0.95);
    expect(report.volume).toBeLessThan(exact * 1.01);
  });

  it('тор: объём ≈ 2π²·R·r²', () => {
    const report = validateMesh(buildMesh(shapeParams('torus', false)));
    const exact = 2 * Math.PI ** 2 * 0.35 * 0.15 ** 2;
    expect(report.volume).toBeGreaterThan(exact * 0.93);
    expect(report.volume).toBeLessThan(exact * 1.02);
  });

  it('суперэллипсоид e1=e2=1 ≈ сфера', () => {
    const a = validateMesh(buildMesh(shapeParams('superellipsoid', false)));
    const b = validateMesh(buildMesh(shapeParams('sphere', false)));
    expect(Math.abs(a.volume - b.volume)).toBeLessThan(b.volume * 0.02);
  });

  it('supershape нормирован в габарит ~1 и z ≥ 0', () => {
    const { grid, height } = shapeGrid('supershape', DEFAULT_SHAPE_PARAMS.supershape, 32, 32);
    let maxAbs = 0;
    let zMin = Infinity;
    for (let i = 0; i < grid.positions.length; i += 3) {
      maxAbs = Math.max(maxAbs, Math.abs(grid.positions[i]), Math.abs(grid.positions[i + 1]));
      zMin = Math.min(zMin, grid.positions[i + 2]);
    }
    expect(maxAbs).toBeLessThanOrEqual(0.51);
    expect(zMin).toBeGreaterThanOrEqual(-1e-6);
    expect(height).toBeGreaterThan(0.05);
    expect(height).toBeLessThanOrEqual(1.01);
  });
});

describe('superformula', () => {
  it('m=0: круг (r = const)', () => {
    const r0 = superformula(0, 0, 1, 1, 1);
    for (const phi of [0.5, 1.5, 3]) {
      expect(superformula(phi, 0, 1, 1, 1)).toBeCloseTo(r0, 9);
    }
  });

  it('конечна и ограничена клампом 10', () => {
    for (let i = 0; i < 200; i++) {
      const r = superformula(i * 0.1, 7, 0.2, 0.3, 0.4);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeLessThanOrEqual(10);
      expect(r).toBeGreaterThan(0);
    }
  });
});

describe('фигуры в состоянии', () => {
  it('sanitize принимает shape-профиль и параметры', () => {
    const out = sanitizeState({ profile: 'torus', shapes: { torus: { R: 0.4, junk: NaN }, evil: { x: 1 } } });
    expect(out?.profile).toBe('torus');
    expect(out?.shapes?.torus?.R).toBe(0.4);
    expect(out?.shapes?.evil).toBeUndefined();
  });

  it('stateToParams мержит только известные ключи фигуры', () => {
    const p = stateToParams({ shapes: { torus: { R: 0.45, hack: 5 } } });
    expect(p.shapes.torus.R).toBe(0.45);
    expect(p.shapes.torus.hack).toBeUndefined();
    expect(p.shapes.torus.r).toBe(DEFAULT_SHAPE_PARAMS.torus.r);
  });
});

describe('новые смещения на фигурах', () => {
  it('gyroid + bytebeat на сфере: валидный меш', () => {
    const p = shapeParams('sphere', false);
    p.displace.gyroid.on = true;
    p.displace.bytebeat.on = true;
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
  });

  it('smooth + quantize в конвейере: watertight сохраняется', () => {
    const p = shapeParams('torus', true);
    p.deform.smooth.on = true;
    p.deform.quantize.on = true;
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
  });
});
