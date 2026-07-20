// Golden-тесты геометрии: подвыборка вершин + объём фиксируют «текущее
// состояние кода» для каждого профиля с дефолтными ripples.
// Регенерация эталонов: UPDATE_GOLDEN=1 npm test
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildMesh, defaultParams } from '../src/geo/build';
import { PROFILE_IDS } from '../src/geo/profiles';
import { validateMesh } from '../src/geo/validate';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'geometry.json');
const SAMPLE_COUNT = 96;

interface GoldenEntry {
  positionsLength: number;
  indicesLength: number;
  volume: number;
  sample: number[];
}

function snapshot(profile: string): GoldenEntry {
  const mesh = buildMesh({ ...defaultParams(), profile, nu: 48, nv: 64 });
  const stride = Math.max(1, Math.floor(mesh.positions.length / SAMPLE_COUNT));
  const sample: number[] = [];
  for (let i = 0; i < mesh.positions.length && sample.length < SAMPLE_COUNT; i += stride) {
    sample.push(mesh.positions[i]);
  }
  return {
    positionsLength: mesh.positions.length,
    indicesLength: mesh.indices.length,
    volume: validateMesh(mesh).volume,
    sample,
  };
}

describe('golden-геометрия', () => {
  const golden: Record<string, GoldenEntry> = {};
  if (process.env.UPDATE_GOLDEN) {
    for (const id of PROFILE_IDS) golden[id] = snapshot(id);
    writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 1));
  } else {
    expect(existsSync(GOLDEN_PATH), `нет эталона ${GOLDEN_PATH}; сгенерируйте: UPDATE_GOLDEN=1 npm test`).toBe(true);
    Object.assign(golden, JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')));
  }

  it.each(PROFILE_IDS.map((id) => [id] as const))('%s совпадает с эталоном', (id) => {
    const ref = golden[id];
    expect(ref, `в эталоне нет профиля ${id}`).toBeDefined();
    const got = snapshot(id);
    expect(got.positionsLength).toBe(ref.positionsLength);
    expect(got.indicesLength).toBe(ref.indicesLength);
    // допуск на разницу Math.sin между версиями V8
    expect(Math.abs(got.volume - ref.volume)).toBeLessThan(1e-6);
    expect(got.sample.length).toBe(ref.sample.length);
    for (let i = 0; i < ref.sample.length; i++) {
      if (Math.abs(got.sample[i] - ref.sample[i]) > 1e-6) {
        expect.fail(`${id}.sample[${i}]: ${got.sample[i]} != ${ref.sample[i]}`);
      }
    }
  });
});
