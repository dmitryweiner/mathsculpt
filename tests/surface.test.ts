// Units of the grid core: dimensions, indexing, the joined seam, caps.
import { sampleGrid, gridIndices, assembleMesh } from '../src/geo/surface';
import { validateMesh } from 'maker-kit/3d/validate';
import { meshNormals } from 'maker-kit/3d/mesh';

const cylinder = (nu: number, nv: number) =>
  sampleGrid(nu, nv, (u, v, out) => {
    out[0] = Math.cos(u);
    out[1] = Math.sin(u);
    out[2] = v;
  });

describe('sampleGrid', () => {
  it('dimensions: nu*(nv+1) vertices, u does not duplicate the seam', () => {
    const g = cylinder(8, 4);
    expect(g.positions.length).toBe(8 * 5 * 3);
    // a ring's first vertex is u=0, with no duplicate at u=2π
    expect(g.positions[0]).toBeCloseTo(1, 6);
    expect(g.positions[1]).toBeCloseTo(0, 6);
  });

  it('refuses degenerate dimensions', () => {
    expect(() => sampleGrid(2, 4, (_u, _v, o) => void o.fill(0))).toThrow('sampleGrid: bad dims 2x4');
    expect(() => sampleGrid(8, 0, (_u, _v, o) => void o.fill(0))).toThrow('sampleGrid: bad dims 8x0');
  });
});

describe('gridIndices', () => {
  it('nu*nv quads → nu*nv*2 triangles, indices in range', () => {
    const idx = gridIndices(8, 4);
    expect(idx.length).toBe(8 * 4 * 6);
    for (const i of idx) expect(i).toBeLessThan(8 * 5);
  });

  it('the seam is joined: the last column refers to i=0', () => {
    const idx = gridIndices(4, 1);
    // quad i=3 must use column 0's vertices
    const lastQuad = Array.from(idx.slice(3 * 6, 4 * 6));
    expect(lastQuad).toContain(0);
  });
});

describe('assembleMesh + caps', () => {
  it('caps=both: a closed oriented mesh (a cylinder)', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'both');
    expect(mesh.positions.length).toBe((16 * 5 + 2) * 3);
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(true);
    expect(report.finite).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    // the volume of a cylinder r=1, h=1: π·r²·h, allowing for the discretisation
    expect(report.volume).toBeGreaterThan(Math.PI * 0.9);
    expect(report.volume).toBeLessThan(Math.PI * 1.01);
  });

  it('caps=none: an open mesh — not watertight', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'none');
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(false);
  });

  it('caps=bottom: one cap — still open at the top', () => {
    const mesh = assembleMesh(cylinder(16, 4), 'bottom');
    expect(mesh.positions.length).toBe((16 * 5 + 1) * 3);
    const report = validateMesh({ ...mesh, normals: meshNormals(mesh.positions, mesh.indices) });
    expect(report.watertight).toBe(false);
  });
});

describe('meshNormals', () => {
  it("a cylinder's side normals are radial, its caps ±z", () => {
    const mesh = assembleMesh(cylinder(32, 8), 'both');
    const normals = meshNormals(mesh.positions, mesh.indices);
    // a vertex in the middle of the side (j=4, i=0): normal ≈ (1,0,0)
    const k = (4 * 32 + 0) * 3;
    expect(normals[k]).toBeGreaterThan(0.99);
    expect(Math.abs(normals[k + 2])).toBeLessThan(0.01);
    // the bottom cap's centre is the last but one vertex, normal (0,0,−1)
    const nb = 32 * 9 * 3;
    expect(normals[nb + 2]).toBeCloseTo(-1, 5);
  });
});
