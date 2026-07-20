// Юниты ядра сетки: размерности, индексация, сшитый шов, крышки.
import { sampleGrid, gridIndices, assembleMesh } from '../src/geo/surface';
import { validateMesh } from '../src/geo/validate';
import { meshNormals } from '../src/geo/normals';

const cylinder = (nu: number, nv: number) =>
  sampleGrid(nu, nv, (u, v, out) => {
    out[0] = Math.cos(u);
    out[1] = Math.sin(u);
    out[2] = v;
  });

describe('sampleGrid', () => {
  it('размерности: nu*(nv+1) вершин, u не дублирует шов', () => {
    const g = cylinder(8, 4);
    expect(g.positions.length).toBe(8 * 5 * 3);
    // первая вершина кольца — u=0, дубликата u=2π нет
    expect(g.positions[0]).toBeCloseTo(1, 6);
    expect(g.positions[1]).toBeCloseTo(0, 6);
  });

  it('отвергает вырожденные размерности', () => {
    expect(() => sampleGrid(2, 4, (_u, _v, o) => void o.fill(0))).toThrow();
    expect(() => sampleGrid(8, 0, (_u, _v, o) => void o.fill(0))).toThrow();
  });
});

describe('gridIndices', () => {
  it('nu*nv квадов → nu*nv*2 треугольников, индексы в диапазоне', () => {
    const idx = gridIndices(8, 4);
    expect(idx.length).toBe(8 * 4 * 6);
    for (const i of idx) expect(i).toBeLessThan(8 * 5);
  });

  it('шов сшит: последний столбец ссылается на i=0', () => {
    const idx = gridIndices(4, 1);
    // квад i=3: должен использовать вершины столбца 0
    const lastQuad = Array.from(idx.slice(3 * 6, 4 * 6));
    expect(lastQuad).toContain(0);
  });
});

describe('assembleMesh + крышки', () => {
  it('caps=both: закрытый ориентированный меш (цилиндр)', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'both');
    expect(mesh.positions.length).toBe((16 * 5 + 2) * 3);
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(true);
    expect(report.finite).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    // объём цилиндра r=1, h=1: π·r²·h с поправкой на дискретизацию
    expect(report.volume).toBeGreaterThan(Math.PI * 0.9);
    expect(report.volume).toBeLessThan(Math.PI * 1.01);
  });

  it('caps=none: открытый меш — не watertight', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'none');
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(false);
  });

  it('caps=bottom: одна крышка — всё ещё открыт сверху', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'bottom');
    expect(mesh.positions.length).toBe((16 * 5 + 1) * 3);
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(false);
  });
});

describe('meshNormals', () => {
  it('у цилиндра боковые нормали радиальные, крышки ±z', () => {
    const mesh = assembleMesh(cylinder(32, 8), 'both');
    const normals = meshNormals(mesh.positions, mesh.indices);
    // вершина середины боковой поверхности (j=4, i=0): нормаль ≈ (1,0,0)
    const k = (4 * 32 + 0) * 3;
    expect(normals[k]).toBeGreaterThan(0.99);
    expect(Math.abs(normals[k + 2])).toBeLessThan(0.01);
    // центр нижней крышки — предпоследняя вершина, нормаль (0,0,−1)
    const nb = (32 * 9) * 3;
    expect(normals[nb + 2]).toBeCloseTo(-1, 5);
  });
});
