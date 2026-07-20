// Свойства геометрии (аналог audio-sanity): каждый профиль, с ripples и без —
// конечность, watertight, нормали наружу (объём > 0), без вырожденных
// треугольников, bbox в разумных пределах.
import { buildMesh, defaultParams } from '../src/geo/build';
import type { BuildParams } from '../src/geo/build';
import { PROFILE_IDS, profileById } from '../src/geo/profiles';
import { validateMesh } from '../src/geo/validate';

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

describe('свойства меша', () => {
  it.each(CASES)('%s (ripples=%s): валидный закрытый меш', (profile, withRipples) => {
    const mesh = buildMesh(params(profile, withRipples));
    const report = validateMesh(mesh);
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    expect(report.degenerateTriangles).toBe(0);

    const def = profileById(profile);
    const { min, max } = report.bbox;
    // xy в пределах максимального радиуса + амплитуда смещения
    const rMax = Math.max(...def.points.map((p) => p.r)) + 0.1;
    expect(Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[1]), Math.abs(max[1]))).toBeLessThan(rMax * 1.2);
    // z покрывает высоту (с допуском на смещение крышек)
    expect(min[2]).toBeGreaterThan(-0.1);
    expect(max[2]).toBeLessThan(def.height + 0.1);
    expect(max[2] - min[2]).toBeGreaterThan(def.height * 0.8);
  });

  it('нормали вершин единичной длины', () => {
    const mesh = buildMesh(params('vase', true));
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it('детерминизм: одинаковые параметры → одинаковый меш', () => {
    const a = buildMesh(params('amphora', true));
    const b = buildMesh(params('amphora', true));
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });
});
