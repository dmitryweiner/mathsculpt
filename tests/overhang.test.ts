// overhangFraction — the share of overhangs steeper than 60° (the kit checks closedness and the export gate).
import { sampleGrid, assembleMesh } from '../src/geo/surface';
import { meshNormals } from 'maker-kit/3d/mesh';
import { overhangFraction } from '../src/geo/overhang';

const revolve = (rOfT: (t: number) => number, nu = 24, nv = 12) =>
  sampleGrid(nu, nv, (u, v, out) => {
    const r = rOfT(v);
    out[0] = r * Math.cos(u);
    out[1] = r * Math.sin(u);
    out[2] = v;
  });

const withNormals = (m: { positions: Float32Array; indices: Uint32Array }) => ({
  ...m,
  normals: meshNormals(m.positions, m.indices),
});

describe('overhangFraction', () => {
  it('a cylinder: no overhangs (the floor excluded, the top cap faces up)', () => {
    const mesh = withNormals(
      assembleMesh(
        revolve(() => 1),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBe(0);
  });

  it('a mushroom (widening upwards steeper than 60°) has a clear overhang', () => {
    // r grows at dr/dz = 3 > tan(60°): the side wall overhangs
    const mesh = withNormals(
      assembleMesh(
        revolve((t) => 0.2 + 3 * t),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBeGreaterThan(0.3);
  });

  it('narrowing upwards: no overhangs', () => {
    const mesh = withNormals(
      assembleMesh(
        revolve((t) => 1 - 0.5 * t),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBe(0);
  });
});
