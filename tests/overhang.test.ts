// overhangFraction — доля свесов круче 60° (замкнутость и сито экспорта проверяет кит).
import { sampleGrid, assembleMesh } from '../src/geo/surface';
import { meshNormals } from '../src/geo/normals';
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
  it('цилиндр: свесов нет (дно исключено, верхняя крышка смотрит вверх)', () => {
    const mesh = withNormals(
      assembleMesh(
        revolve(() => 1),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBe(0);
  });

  it('гриб (резкое расширение вверх круче 60°) — свес заметен', () => {
    // r растёт со скоростью dr/dz = 3 > tan(60°): боковая стенка нависает
    const mesh = withNormals(
      assembleMesh(
        revolve((t) => 0.2 + 3 * t),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBeGreaterThan(0.3);
  });

  it('сужение кверху — свесов нет', () => {
    const mesh = withNormals(
      assembleMesh(
        revolve((t) => 1 - 0.5 * t),
        'both',
      ),
    );
    expect(overhangFraction(mesh)).toBe(0);
  });
});
