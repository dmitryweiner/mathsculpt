// Деформеры: twist, taper, симметрия. Плюс сохранение watertight в конвейере.
import { applyDeformer, DEFORM_IDS, DEFAULT_DEFORM_PARAMS } from '../src/geo/deform';
import { sampleGrid } from '../src/geo/surface';
import { buildMesh, defaultParams } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';

const unitCylinder = () =>
  sampleGrid(16, 8, (u, v, out) => {
    out[0] = Math.cos(u);
    out[1] = Math.sin(u);
    out[2] = v;
  });

describe('twist', () => {
  it('поворачивает верхнее кольцо на 2π·turns, z не трогает', () => {
    const g = unitCylinder();
    applyDeformer('twist', g, { turns: 0.25 });
    // вершина (i=0, j=nv): угол был 0, стал π/2
    const k = (8 * 16) * 3;
    expect(g.positions[k]).toBeCloseTo(0, 5);
    expect(g.positions[k + 1]).toBeCloseTo(1, 5);
    expect(g.positions[k + 2]).toBeCloseTo(1, 5);
    // нижнее кольцо не повёрнуто
    expect(g.positions[0]).toBeCloseTo(1, 5);
  });

  it('turns=0 — без изменений', () => {
    const g = unitCylinder();
    const before = Array.from(g.positions);
    applyDeformer('twist', g, { turns: 0 });
    expect(Array.from(g.positions)).toEqual(before);
  });
});

describe('taper', () => {
  it('сжимает верх на 1−amount, низ не трогает', () => {
    const g = unitCylinder();
    applyDeformer('taper', g, { amount: 0.4, power: 1 });
    const top = (8 * 16) * 3;
    expect(Math.hypot(g.positions[top], g.positions[top + 1])).toBeCloseTo(0.6, 5);
    expect(Math.hypot(g.positions[0], g.positions[1])).toBeCloseTo(1, 5);
  });

  it('amount<0 расширяет', () => {
    const g = unitCylinder();
    applyDeformer('taper', g, { amount: -0.5, power: 1 });
    const top = (8 * 16) * 3;
    expect(Math.hypot(g.positions[top], g.positions[top + 1])).toBeCloseTo(1.5, 5);
  });
});

describe('symmetry', () => {
  // бугор на одной стороне: r = 1 + 0.3·exp по u около 0
  const bumped = () =>
    sampleGrid(24, 4, (u, v, out) => {
      const r = 1 + 0.3 * Math.exp(-8 * Math.min(u, 2 * Math.PI - u) ** 2);
      out[0] = r * Math.cos(u);
      out[1] = r * Math.sin(u);
      out[2] = v;
    });

  it('mix=0 — без изменений', () => {
    const g = bumped();
    const before = Array.from(g.positions);
    applyDeformer('symmetry', g, { k: 6, mix: 0 });
    expect(Array.from(g.positions)).toEqual(before);
  });

  it('k=1 — без изменений', () => {
    const g = bumped();
    const before = Array.from(g.positions);
    applyDeformer('symmetry', g, { k: 1, mix: 1 });
    expect(Array.from(g.positions)).toEqual(before);
  });

  it('после k=3 (nu кратно k) поверхность 3-кратно симметрична', () => {
    const g = bumped();
    applyDeformer('symmetry', g, { k: 3, mix: 1 });
    const nu = g.nu;
    const shift = nu / 3;
    // радиус вершины i и i+nu/3 в одном кольце совпадает
    for (let i = 0; i < nu; i++) {
      const a = (2 * nu + i) * 3;
      const b = (2 * nu + ((i + shift) % nu)) * 3;
      const ra = Math.hypot(g.positions[a], g.positions[a + 1]);
      const rb = Math.hypot(g.positions[b], g.positions[b + 1]);
      expect(ra).toBeCloseTo(rb, 4);
    }
  });

  it('осесимметричный цилиндр почти неподвижен при любом k', () => {
    // дробные колонки интерполируются хордой: радиус проседает ≤ (π/nu)²/2
    const g = sampleGrid(64, 4, (u, v, out) => {
      out[0] = Math.cos(u);
      out[1] = Math.sin(u);
      out[2] = v;
    });
    applyDeformer('symmetry', g, { k: 5, mix: 1 });
    const chordErr = (Math.PI / 64) ** 2 / 2;
    for (let i = 0; i < g.positions.length; i += 3) {
      const r = Math.hypot(g.positions[i], g.positions[i + 1]);
      expect(r).toBeLessThanOrEqual(1 + 1e-6);
      expect(r).toBeGreaterThan(1 - 2 * chordErr);
    }
  });
});

describe('деформеры в конвейере', () => {
  it.each([...DEFORM_IDS])('%s: меш остаётся watertight и конечным', (id) => {
    const p = defaultParams();
    p.nu = 48;
    p.nv = 48;
    p.deform[id] = { on: true, params: { ...DEFAULT_DEFORM_PARAMS[id] } };
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    expect(report.degenerateTriangles).toBe(0);
  });

  it('все деформеры разом + все смещения — валидный меш', () => {
    const p = defaultParams();
    p.nu = 48;
    p.nv = 48;
    for (const id of DEFORM_IDS) p.deform[id].on = true;
    for (const card of Object.values(p.displace)) card.on = true;
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });
});
