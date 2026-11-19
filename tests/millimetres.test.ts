// Граница единиц: ядро считает в относительных единицах, вид и STL — в
// миллиметрах. Меш масштабируется целиком так, чтобы его высота стала
// высотой модели в мм; STL кита пишет миллиметры как есть.
import { encodeSTL, parseSTL } from 'maker-kit/3d/stl';
import { buildMesh } from '../src/geo/build';
import { toMillimetres } from '../src/geo/millimetres';
import { buildParamsOf, defaultState } from '../src/state/schema';

const model = buildMesh({ ...buildParamsOf(defaultState()), nu: 24, nv: 16 });

function extents(positions: Float32Array): [number, number, number] {
  const span = (c: number): number => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = c; i < positions.length; i += 3) {
      const v = positions[i] ?? 0;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    return max - min;
  };
  return [span(0), span(1), span(2)];
}

describe('toMillimetres', () => {
  it('высота меша — высота модели в мм, пропорции те же', () => {
    const [x, y, z] = extents(model.positions);
    const mm = toMillimetres(model, 150);
    const [mx, my, mz] = extents(mm.positions);
    expect(mz).toBeCloseTo(150, 3);
    expect(mx / mz).toBeCloseTo(x / z, 5);
    expect(my / mz).toBeCloseTo(y / z, 5);
  });

  it('индексы и нормали те же, исходный меш не тронут', () => {
    const before = model.positions.slice();
    const mm = toMillimetres(model, 120);
    expect(mm.indices).toBe(model.indices);
    expect(mm.normals).toBe(model.normals);
    expect(model.positions).toEqual(before);
  });

  it('STL кита пишет миллиметры: разобранный файл той же высоты', () => {
    const parsed = parseSTL(encodeSTL(toMillimetres(model, 90), { brand: 'MathSculpt', name: 'vase' }));
    expect(extents(parsed.positions)[2]).toBeCloseTo(90, 3);
    expect(parsed.indices.length).toBe(model.indices.length);
  });
});
