// Плоское дно тел вращения и полый сосуд (open top + wall > 0).
import { buildMesh, defaultParams } from '../src/geo/build';
import type { BuildParams } from '../src/geo/build';
import { PROFILE_IDS } from '../src/geo/profiles';
import { validateMesh } from '../src/geo/validate';

function vessel(profile: string, caps: BuildParams['caps'], wall: number, ripples = true): BuildParams {
  const p = defaultParams();
  p.profile = profile;
  p.nu = 48;
  p.nv = 48;
  p.caps = caps;
  p.wall = wall;
  p.displace.ripples.on = ripples;
  return p;
}

/** Рёбра, встречающиеся ровно в одном треугольнике (граница открытой поверхности). */
function boundaryVertexZ(mesh: { positions: Float32Array; indices: Uint32Array }): number[] {
  const nV = mesh.positions.length / 3;
  const count = new Map<number, number>();
  const key = (a: number, b: number): number => (a < b ? a * nV + b : b * nV + a);
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const k = key(a, b);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const zs: number[] = [];
  for (const [k, c] of count) {
    if (c === 1) {
      const a = Math.floor(k / nV);
      const b = k % nV;
      zs.push(mesh.positions[a * 3 + 2], mesh.positions[b * 3 + 2]);
    }
  }
  return zs;
}

describe('плоское дно (fade смещений у v=0)', () => {
  it.each([...PROFILE_IDS])('%s: нижнее кольцо плоское и неискажённое при ripples', (profile) => {
    const mesh = buildMesh(vessel(profile, 'both', 0, true));
    // первые nu вершин — кольцо j=0; z должны совпадать (плоскость), radius ровный
    const nu = 48;
    const z0 = mesh.positions[2];
    let rMin = Infinity;
    let rMax = 0;
    for (let i = 0; i < nu; i++) {
      const k = i * 3;
      expect(mesh.positions[k + 2]).toBeCloseTo(z0, 5); // плоское дно
      const r = Math.hypot(mesh.positions[k], mesh.positions[k + 1]);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    // без искажений ripples кольцо круглое
    expect(rMax - rMin).toBeLessThan(1e-4);
  });
});

describe('дно строится (open top, нулевая толщина)', () => {
  it.each([...PROFILE_IDS])('%s: граница только сверху, низ закрыт', (profile) => {
    const mesh = buildMesh(vessel(profile, 'bottom', 0, true));
    const zs = boundaryVertexZ(mesh);
    expect(zs.length).toBeGreaterThan(0); // верх открыт
    const zMinAll = Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    const zMaxAll = Math.max(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    const mid = (zMinAll + zMaxAll) / 2;
    // все граничные вершины — у верхнего отверстия, не у дна
    for (const z of zs) expect(z).toBeGreaterThan(mid);
  });

  it('bottle: дно закрыто (нет открытой границы у z_min)', () => {
    const mesh = buildMesh(vessel('bottle', 'bottom', 0, true));
    const zs = boundaryVertexZ(mesh);
    const zMinAll = Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    for (const z of zs) expect(z).toBeGreaterThan(zMinAll + 0.3);
  });
});

describe('полый сосуд (open top + wall > 0)', () => {
  it.each([...PROFILE_IDS])('%s: watertight-солид с положительным объёмом', (profile) => {
    const report = validateMesh(buildMesh(vessel(profile, 'bottom', 0.02, true)));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });

  it('полый объём заметно меньше сплошного (это оболочка + дно)', () => {
    const solid = validateMesh(buildMesh(vessel('vase', 'both', 0, false)));
    const hollow = validateMesh(buildMesh(vessel('vase', 'bottom', 0.02, false)));
    expect(hollow.volume).toBeGreaterThan(0);
    expect(hollow.volume).toBeLessThan(solid.volume * 0.7);
  });

  it('толщина стенки клампится долей радиуса — не пересекает ось', () => {
    // огромная стенка не должна ломать watertight
    const report = validateMesh(buildMesh(vessel('vase', 'bottom', 5, false)));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });

  it('wall=0 в open top → оболочка (не watertight), wall>0 → солид (watertight)', () => {
    expect(validateMesh(buildMesh(vessel('amphora', 'bottom', 0, false))).watertight).toBe(false);
    expect(validateMesh(buildMesh(vessel('amphora', 'bottom', 0.02, false))).watertight).toBe(true);
  });
});
