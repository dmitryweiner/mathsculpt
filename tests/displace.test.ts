// Смещения: формулы, замкнутость по шву, детерминизм, применение стека.
import { makeDisplace, applyDisplacements, DISPLACE_IDS, DEFAULT_DISPLACE_PARAMS } from '../src/geo/displace';
import { sampleGrid } from '../src/geo/surface';
import { gridNormals } from '../src/geo/normals';
import { simplex3, fbm3 } from '../src/geo/noise';
import { sphericalHarmonic, legendreP } from '../src/geo/harmonics';

const TWO_PI = 2 * Math.PI;

describe('свойства всех смещений', () => {
  it.each([...DISPLACE_IDS])('%s: конечно и ограничено ~amp на дефолтах', (id) => {
    const p = DEFAULT_DISPLACE_PARAMS[id];
    const f = makeDisplace(id, p);
    for (let i = 0; i < 400; i++) {
      const u = (i % 20) * (TWO_PI / 20);
      const v = Math.floor(i / 20) / 20;
      const d = f(u, v, 0.4 * Math.cos(u), 0.4 * Math.sin(u), v);
      expect(Number.isFinite(d)).toBe(true);
      // Yₗₘ и fBm могут слегка превышать amp; допуск ×3
      expect(Math.abs(d)).toBeLessThanOrEqual(p.amp * 3);
    }
  });

  it.each([...DISPLACE_IDS])('%s: шов замкнут — d(0,v) = d(2π,v)', (id) => {
    const f = makeDisplace(id, DEFAULT_DISPLACE_PARAMS[id]);
    for (const v of [0, 0.3, 0.77, 1]) {
      const p0 = [0.4, 0, v];
      expect(f(0, v, p0[0], p0[1], p0[2])).toBeCloseTo(f(TWO_PI, v, p0[0], p0[1], p0[2]), 6);
    }
  });
});

describe('ripples и lissajous', () => {
  it('ripples: A·sin(a·u + b·2π·v + φ)', () => {
    const f = makeDisplace('ripples', { amp: 0.5, freqU: 3, freqV: 2, phase: 0.7 });
    expect(f(1.1, 0.3, 0, 0, 0)).toBeCloseTo(0.5 * Math.sin(3 * 1.1 + 2 * TWO_PI * 0.3 + 0.7), 9);
  });

  it('lissajous: произведение синусов', () => {
    const f = makeDisplace('lissajous', { amp: 1, freqU: 2, freqV: 1, phaseU: 0.2, phaseV: 0.4 });
    expect(f(0.9, 0.6, 0, 0, 0)).toBeCloseTo(Math.sin(2 * 0.9 + 0.2) * Math.sin(TWO_PI * 0.6 + 0.4), 9);
  });
});

describe('сферические гармоники', () => {
  it('P_l^m: известные значения', () => {
    expect(legendreP(0, 0, 0.5)).toBeCloseTo(1, 9);
    expect(legendreP(1, 0, 0.5)).toBeCloseTo(0.5, 9);
    expect(legendreP(1, 1, 0.5)).toBeCloseTo(-Math.sqrt(0.75), 9);
    expect(legendreP(2, 0, 0.5)).toBeCloseTo(0.5 * (3 * 0.25 - 1), 9);
  });

  it('Y00·√4π = 1 всюду', () => {
    for (const [th, ph] of [[0.1, 0], [1.5, 2], [3, 5]]) {
      expect(sphericalHarmonic(0, 0, th, ph)).toBeCloseTo(1, 9);
    }
  });

  it('|m| обрезается до l, дробные l/m округляются', () => {
    expect(sphericalHarmonic(2, 5, 1, 1)).toBeCloseTo(sphericalHarmonic(2, 2, 1, 1), 9);
    expect(sphericalHarmonic(2.4, 1.1, 1, 1)).toBeCloseTo(sphericalHarmonic(2, 1, 1, 1), 9);
  });

  it('m<0 — sin-форма: ноль при φ=0', () => {
    expect(sphericalHarmonic(3, -2, 1.2, 0)).toBeCloseTo(0, 9);
  });
});

describe('simplex fBm-шум', () => {
  it('детерминизм: одинаковый сид → одинаковое поле', () => {
    const a = simplex3(42);
    const b = simplex3(42);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37, y = i * 0.91, z = i * 0.13;
      expect(a(x, y, z)).toBe(b(x, y, z));
    }
  });

  it('разные сиды → разные поля', () => {
    const a = simplex3(1);
    const b = simplex3(2);
    let differs = false;
    for (let i = 0; i < 20 && !differs; i++) {
      if (a(i * 0.7, 0.3, 0.9) !== b(i * 0.7, 0.3, 0.9)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('выход ограничен [−1.2, 1.2] и не константен', () => {
    const f = fbm3(simplex3(7), 4);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const v = f(i * 0.11, (i % 13) * 0.29, (i % 7) * 0.53);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThan(-1.2);
    expect(max).toBeLessThan(1.2);
    expect(max - min).toBeGreaterThan(0.3);
  });
});

describe('waves', () => {
  it('меандр (shape=2): значения только ±amp', () => {
    const f = makeDisplace('waves', { amp: 0.4, shape: 2, freqU: 6, freqV: 0, phase: 0 });
    for (let i = 0; i < 100; i++) {
      const d = f((i / 100) * TWO_PI, 0.5, 0, 0, 0);
      expect(Math.abs(Math.abs(d) - 0.4)).toBeLessThan(1e-9);
    }
  });

  it('пила (shape=1): линейный рост внутри периода', () => {
    const f = makeDisplace('waves', { amp: 1, shape: 1, freqU: 1, freqV: 0, phase: 0 });
    expect(f(0, 0, 0, 0, 0)).toBeCloseTo(-1, 9);
    expect(f(Math.PI, 0, 0, 0, 0)).toBeCloseTo(0, 9);
  });

  it('треугольник (shape=0): пик на краях периода', () => {
    const f = makeDisplace('waves', { amp: 1, shape: 0, freqU: 1, freqV: 0, phase: 0 });
    expect(f(0, 0, 0, 0, 0)).toBeCloseTo(1, 9);
    expect(f(Math.PI, 0, 0, 0, 0)).toBeCloseTo(-1, 9);
  });
});

describe('applyDisplacements', () => {
  const unitCylinder = () =>
    sampleGrid(16, 4, (u, v, out) => {
      out[0] = Math.cos(u);
      out[1] = Math.sin(u);
      out[2] = v;
    });

  it('пустой стек — сетка не меняется', () => {
    const g = unitCylinder();
    const before = Array.from(g.positions);
    applyDisplacements(g, gridNormals(g), []);
    expect(Array.from(g.positions)).toEqual(before);
  });

  it('константное смещение d=c сдвигает вдоль нормали на c', () => {
    const g = unitCylinder();
    applyDisplacements(g, gridNormals(g), [{ fn: () => 0.5, weight: 1 }]);
    const k = (2 * 16 + 3) * 3;
    const r = Math.hypot(g.positions[k], g.positions[k + 1]);
    expect(r).toBeCloseTo(1.5, 5);
  });

  it('веса складываются: w1·d1 + w2·d2', () => {
    const a = unitCylinder();
    applyDisplacements(a, gridNormals(a), [
      { fn: () => 0.2, weight: 1 },
      { fn: () => 0.3, weight: 2 },
    ]);
    const b = unitCylinder();
    applyDisplacements(b, gridNormals(b), [{ fn: () => 0.8, weight: 1 }]);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it('смещению передаётся позиция точки базовой поверхности', () => {
    const g = unitCylinder();
    const seen: number[][] = [];
    applyDisplacements(g, gridNormals(g), [
      { fn: (_u, _v, px, py, pz) => (seen.push([px, py, pz]), 0), weight: 1 },
    ]);
    expect(seen.length).toBe(16 * 5);
    const [px, py, pz] = seen[0];
    expect(px).toBeCloseTo(1, 5);
    expect(py).toBeCloseTo(0, 5);
    expect(pz).toBeCloseTo(0, 5);
  });
});
