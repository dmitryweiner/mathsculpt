// Базовые фигуры-носители. Фаза 1: тело вращения (revolve).

import type { Grid } from './surface';
import { sampleGrid } from './surface';

export interface RevolveOptions {
  nu: number;
  nv: number;
  /** высота в единицах профиля (z = t·height) */
  height: number;
}

/** Тело вращения: профиль r(t) вокруг оси z. u — азимут, v = t. */
export function revolveGrid(radiusFn: (t: number) => number, o: RevolveOptions): Grid {
  return sampleGrid(o.nu, o.nv, (u, v, out) => {
    const r = radiusFn(v);
    out[0] = r * Math.cos(u);
    out[1] = r * Math.sin(u);
    out[2] = v * o.height;
  });
}
