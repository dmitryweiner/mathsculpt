// The flat base of solids of revolution and the hollow vessel (open top + wall > 0).
import { buildMesh, defaultParams } from '../src/geo/build';
import type { BuildParams } from '../src/geo/build';
import { PROFILE_IDS } from '../src/geo/profiles';
import { validateMesh } from 'maker-kit/3d/validate';

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

/** Edges found in exactly one triangle (an open surface's boundary). */
function boundaryVertexZ(mesh: { positions: Float32Array; indices: Uint32Array }): number[] {
  const nV = mesh.positions.length / 3;
  const count = new Map<number, number>();
  const key = (a: number, b: number): number => (a < b ? a * nV + b : b * nV + a);
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    for (const [a, b] of [
      [tri[0], tri[1]],
      [tri[1], tri[2]],
      [tri[2], tri[0]],
    ]) {
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

describe('a flat base (the displacements fade at v=0)', () => {
  it.each([...PROFILE_IDS])('%s: the bottom ring is flat and undistorted with ripples', (profile) => {
    const mesh = buildMesh(vessel(profile, 'both', 0, true));
    // the first nu vertices are ring j=0; their z must match (a plane), the radius even
    const nu = 48;
    const z0 = mesh.positions[2];
    let rMin = Infinity;
    let rMax = 0;
    for (let i = 0; i < nu; i++) {
      const k = i * 3;
      expect(mesh.positions[k + 2]).toBeCloseTo(z0, 5); // a flat base
      const r = Math.hypot(mesh.positions[k], mesh.positions[k + 1]);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    // with no ripple distortion the ring is round
    expect(rMax - rMin).toBeLessThan(1e-4);
  });
});

describe('the floor is built (open top, zero thickness)', () => {
  it.each([...PROFILE_IDS])('%s: a boundary at the top only, the bottom closed', (profile) => {
    const mesh = buildMesh(vessel(profile, 'bottom', 0, true));
    const zs = boundaryVertexZ(mesh);
    expect(zs.length).toBeGreaterThan(0); // the top is open
    const zMinAll = Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    const zMaxAll = Math.max(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    const mid = (zMinAll + zMaxAll) / 2;
    // every boundary vertex is at the top opening, none at the floor
    for (const z of zs) expect(z).toBeGreaterThan(mid);
  });

  it('bottle: the floor is closed (no open boundary at z_min)', () => {
    const mesh = buildMesh(vessel('bottle', 'bottom', 0, true));
    const zs = boundaryVertexZ(mesh);
    const zMinAll = Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2)));
    for (const z of zs) expect(z).toBeGreaterThan(zMinAll + 0.3);
  });
});

describe('a hollow vessel (open top + wall > 0)', () => {
  it.each([...PROFILE_IDS])('%s: a watertight solid with a positive volume', (profile) => {
    const report = validateMesh(buildMesh(vessel(profile, 'bottom', 0.02, true)));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });

  it('the hollow volume is well below the solid one (a shell + a floor)', () => {
    const solid = validateMesh(buildMesh(vessel('vase', 'both', 0, false)));
    const hollow = validateMesh(buildMesh(vessel('vase', 'bottom', 0.02, false)));
    expect(hollow.volume).toBeGreaterThan(0);
    expect(hollow.volume).toBeLessThan(solid.volume * 0.7);
  });

  it('the wall thickness is clamped by a share of the radius — it never crosses the axis', () => {
    // a huge wall must not break watertightness
    const report = validateMesh(buildMesh(vessel('vase', 'bottom', 5, false)));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
  });

  it('wall=0 in open top → a shell (not watertight), wall>0 → a solid (watertight)', () => {
    expect(validateMesh(buildMesh(vessel('amphora', 'bottom', 0, false))).watertight).toBe(false);
    expect(validateMesh(buildMesh(vessel('amphora', 'bottom', 0.02, false))).watertight).toBe(true);
  });

  it('the inner wall has the set radial offset', () => {
    const p = vessel('bottle', 'bottom', 0.02, false);
    const mesh = buildMesh(p);
    const outerCount = p.nu * (p.nv + 1);
    const row = Math.floor(p.nv * 0.7);
    for (let i = 0; i < p.nu; i += 7) {
      const outer = (row * p.nu + i) * 3;
      const inner = (outerCount + row * p.nu + i) * 3;
      const ro = Math.hypot(mesh.positions[outer], mesh.positions[outer + 1]);
      const ri = Math.hypot(mesh.positions[inner], mesh.positions[inner + 1]);
      expect(ro - ri).toBeCloseTo(0.02, 5);
      expect(mesh.positions[inner + 2]).toBeCloseTo(mesh.positions[outer + 2], 6);
    }
  });
});
