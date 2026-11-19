// Geometry properties (the counterpart of audio sanity checks): every
// profile, with and without ripples — finite, watertight, normals outwards
// (volume > 0), no degenerate triangles, a bbox within sane limits.
import { buildMesh, defaultParams } from '../src/geo/build';
import type { BuildParams } from '../src/geo/build';
import { PROFILE_IDS, profileById } from '../src/geo/profiles';
import { validateMesh } from 'maker-kit/3d/validate';

const CASES: [string, boolean][] = PROFILE_IDS.flatMap((id) => [
  [id, false],
  [id, true],
]);

function params(profile: string, withRipples: boolean): BuildParams {
  const p = defaultParams();
  p.profile = profile;
  p.nu = 64;
  p.nv = 64;
  p.displace.ripples.on = withRipples;
  return p;
}

describe('mesh properties', () => {
  it.each(CASES)('%s (ripples=%s): a valid closed mesh', (profile, withRipples) => {
    const mesh = buildMesh(params(profile, withRipples));
    const report = validateMesh(mesh);
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    expect(report.degenerateTriangles).toBe(0);

    const def = profileById(profile);
    const { min, max } = report.bbox;
    // xy within the largest radius + the displacement amplitude
    const rMax = Math.max(...def.points.map((p) => p.r)) + 0.1;
    expect(Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[1]), Math.abs(max[1]))).toBeLessThan(rMax * 1.2);
    // z covers the height (allowing for the caps moving)
    expect(min[2]).toBeGreaterThan(-0.1);
    expect(max[2]).toBeLessThan(def.height + 0.1);
    expect(max[2] - min[2]).toBeGreaterThan(def.height * 0.8);
  });

  it('vertex normals have unit length', () => {
    const mesh = buildMesh(params('vase', true));
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it('determinism: the same parameters → the same mesh', () => {
    const a = buildMesh(params('amphora', true));
    const b = buildMesh(params('amphora', true));
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });
});
