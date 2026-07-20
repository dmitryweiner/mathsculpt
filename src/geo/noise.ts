// 3D simplex-шум (Стефан Густавсон) с детерминированной перестановкой от
// сида + fBm. Шов u=0/2π бесшовен, потому что displace семплирует шум на
// цилиндре в 3D (см. displace.ts), а не в (u,v)-плоскости.

import { mulberry32 } from './rng';

const GRAD3: readonly (readonly [number, number, number])[] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const F3 = 1 / 3;
const G3 = 1 / 6;

export type Noise3 = (x: number, y: number, z: number) => number;

/** Simplex-шум 3D, выход ≈ [−1, 1]. */
export function simplex3(seed: number): Noise3 {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  const rnd = mulberry32(seed);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    let n = 0;

    const corner = (x: number, y: number, z: number, gi: number): number => {
      let tt = 0.6 - x * x - y * y - z * z;
      if (tt < 0) return 0;
      tt *= tt;
      const g = GRAD3[gi % 12];
      return tt * tt * (g[0] * x + g[1] * y + g[2] * z);
    };

    n += corner(x0, y0, z0, perm[ii + perm[jj + perm[kk]]]);
    n += corner(x1, y1, z1, perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]);
    n += corner(x2, y2, z2, perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]);
    n += corner(x3, y3, z3, perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]]);
    return 32 * n;
  };
}

/** fBm: Σ noise(2ᵏ·x)/2ᵏ, нормировано к ≈[−1,1]. */
export function fbm3(noise: Noise3, octaves: number): Noise3 {
  const n = Math.max(1, Math.min(8, Math.round(octaves)));
  let norm = 0;
  for (let o = 0; o < n; o++) norm += 1 / 2 ** o;
  return (x, y, z) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < n; o++) {
      sum += amp * noise(x * f, y * f, z * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}
