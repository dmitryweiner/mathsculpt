// STL: закодировать и разобрать буфер обратно — структура, масштаб, нормали.
import { encodeSTL } from '../src/geo/stl';
import { buildMesh, defaultParams } from '../src/geo/build';

interface ParsedStl {
  header: string;
  triCount: number;
  normals: number[][];
  vertices: number[][][];
}

function decodeSTL(buf: ArrayBuffer): ParsedStl {
  const dv = new DataView(buf);
  const header = new TextDecoder().decode(new Uint8Array(buf, 0, 80)).replace(/\0+$/, '');
  const triCount = dv.getUint32(80, true);
  const normals: number[][] = [];
  const vertices: number[][][] = [];
  let off = 84;
  for (let t = 0; t < triCount; t++) {
    normals.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);
    off += 12;
    const tri: number[][] = [];
    for (let v = 0; v < 3; v++) {
      tri.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);
      off += 12;
    }
    vertices.push(tri);
    off += 2; // attribute byte count
  }
  return { header, triCount, normals, vertices };
}

describe('encodeSTL', () => {
  const mesh = buildMesh({ ...defaultParams(), nu: 24, nv: 16 });

  it('размер буфера = 84 + 50·triCount, заголовок и счётчик корректны', () => {
    const buf = encodeSTL(mesh, { scale: 100, name: 'vase' });
    const triCount = mesh.indices.length / 3;
    expect(buf.byteLength).toBe(84 + triCount * 50);
    const parsed = decodeSTL(buf);
    expect(parsed.triCount).toBe(triCount);
    expect(parsed.header).toContain('MathSculpt');
    expect(parsed.header).toContain('vase');
  });

  it('вершины = позиции × scale (мм), треугольники в исходном порядке', () => {
    const scale = 80;
    const parsed = decodeSTL(encodeSTL(mesh, { scale }));
    for (let t = 0; t < 5; t++) {
      for (let v = 0; v < 3; v++) {
        const src = mesh.indices[t * 3 + v] * 3;
        for (let c = 0; c < 3; c++) {
          expect(parsed.vertices[t][v][c]).toBeCloseTo(mesh.positions[src + c] * scale, 3);
        }
      }
    }
  });

  it('нормали единичные и согласованы с обходом вершин', () => {
    const parsed = decodeSTL(encodeSTL(mesh, { scale: 1 }));
    for (let t = 0; t < parsed.triCount; t += 17) {
      const [n, tri] = [parsed.normals[t], parsed.vertices[t]];
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 4);
      const ab = tri[1].map((x, c) => x - tri[0][c]);
      const ac = tri[2].map((x, c) => x - tri[0][c]);
      const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      const len = Math.hypot(cross[0], cross[1], cross[2]);
      // косинус угла между нормалью и произведением обхода ≈ 1
      const dot = (n[0] * cross[0] + n[1] * cross[1] + n[2] * cross[2]) / len;
      expect(dot).toBeGreaterThan(0.999);
    }
  });
});
