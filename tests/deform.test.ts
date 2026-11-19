// Deformers: twist, taper, symmetry. Plus watertightness kept in the pipeline.
import { applyDeformer, DEFORM_IDS, DEFAULT_DEFORM_PARAMS } from '../src/geo/deform';
import { sampleGrid } from '../src/geo/surface';
import { buildMesh, defaultParams } from '../src/geo/build';
import { validateMesh } from 'maker-kit/3d/validate';

const unitCylinder = () =>
  sampleGrid(16, 8, (u, v, out) => {
    out[0] = Math.cos(u);
    out[1] = Math.sin(u);
    out[2] = v;
  });

describe('twist', () => {
  it('turns the top ring by 2π·turns, leaves z alone', () => {
    const g = unitCylinder();
    applyDeformer('twist', g, { turns: 0.25 });
    // vertex (i=0, j=nv): its angle was 0, now π/2
    const k = 8 * 16 * 3;
    expect(g.positions[k]).toBeCloseTo(0, 5);
    expect(g.positions[k + 1]).toBeCloseTo(1, 5);
    expect(g.positions[k + 2]).toBeCloseTo(1, 5);
    // the bottom ring is not turned
    expect(g.positions[0]).toBeCloseTo(1, 5);
  });

  it('turns=0 changes nothing', () => {
    const g = unitCylinder();
    const before = Array.from(g.positions);
    applyDeformer('twist', g, { turns: 0 });
    expect(Array.from(g.positions)).toEqual(before);
  });
});

describe('taper', () => {
  it('shrinks the top by 1−amount, leaves the bottom alone', () => {
    const g = unitCylinder();
    applyDeformer('taper', g, { amount: 0.4, power: 1 });
    const top = 8 * 16 * 3;
    expect(Math.hypot(g.positions[top], g.positions[top + 1])).toBeCloseTo(0.6, 5);
    expect(Math.hypot(g.positions[0], g.positions[1])).toBeCloseTo(1, 5);
  });

  it('amount<0 widens', () => {
    const g = unitCylinder();
    applyDeformer('taper', g, { amount: -0.5, power: 1 });
    const top = 8 * 16 * 3;
    expect(Math.hypot(g.positions[top], g.positions[top + 1])).toBeCloseTo(1.5, 5);
  });
});

describe('symmetry', () => {
  // a bump on one side: r = 1 + 0.3·exp over u around 0
  const bumped = () =>
    sampleGrid(24, 4, (u, v, out) => {
      const r = 1 + 0.3 * Math.exp(-8 * Math.min(u, 2 * Math.PI - u) ** 2);
      out[0] = r * Math.cos(u);
      out[1] = r * Math.sin(u);
      out[2] = v;
    });

  it('mix=0 changes nothing', () => {
    const g = bumped();
    const before = Array.from(g.positions);
    applyDeformer('symmetry', g, { k: 6, mix: 0 });
    expect(Array.from(g.positions)).toEqual(before);
  });

  it('k=1 changes nothing', () => {
    const g = bumped();
    const before = Array.from(g.positions);
    applyDeformer('symmetry', g, { k: 1, mix: 1 });
    expect(Array.from(g.positions)).toEqual(before);
  });

  it('after k=3 (nu a multiple of k) the surface is 3-fold symmetric', () => {
    const g = bumped();
    applyDeformer('symmetry', g, { k: 3, mix: 1 });
    const nu = g.nu;
    const shift = nu / 3;
    // the radii of vertices i and i+nu/3 in one ring match
    for (let i = 0; i < nu; i++) {
      const a = (2 * nu + i) * 3;
      const b = (2 * nu + ((i + shift) % nu)) * 3;
      const ra = Math.hypot(g.positions[a], g.positions[a + 1]);
      const rb = Math.hypot(g.positions[b], g.positions[b + 1]);
      expect(ra).toBeCloseTo(rb, 4);
    }
  });

  it('an axisymmetric cylinder hardly moves at any k', () => {
    // fractional columns are interpolated along a chord: the radius sags by ≤ (π/nu)²/2
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

describe('deformers in the pipeline', () => {
  it.each([...DEFORM_IDS])('%s: the mesh stays watertight and finite', (id) => {
    const p = defaultParams();
    p.nu = 48;
    p.nv = 48;
    p.deform[id] = { on: true, params: { ...DEFAULT_DEFORM_PARAMS[id] } };
    const report = validateMesh(buildMesh(p));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    // quantize collapses some triangles flat by its nature
    if (id !== 'quantize') expect(report.degenerateTriangles).toBe(0);
  });

  it('every deformer at once + every displacement — a valid mesh', () => {
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
