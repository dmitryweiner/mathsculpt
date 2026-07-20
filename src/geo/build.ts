// Конвейер геометрии (см. PLAN.md): профиль → сетка → смещения по нормали →
// деформеры → крышки → нормали. Чистая функция параметров — используется
// главным потоком сейчас и Web Worker'ом в фазе 3.

import type { CapMode, SurfaceMesh } from './surface';
import { assembleMesh } from './surface';
import { revolveGrid } from './shapes';
import { profileById, profileRadius } from './profiles';
import { gridNormals, meshNormals } from './normals';
import type { DisplaceEntry, DisplaceId, Params } from './displace';
import { DISPLACE_IDS, DEFAULT_DISPLACE_PARAMS, applyDisplacements, makeDisplace } from './displace';
import type { DeformId } from './deform';
import { DEFORM_IDS, DEFAULT_DEFORM_PARAMS, applyDeformer } from './deform';

export interface CardState {
  on: boolean;
  params: Params;
}

export interface BuildParams {
  profile: string;
  nu: number;
  nv: number;
  caps: CapMode;
  displace: Record<DisplaceId, CardState>;
  deform: Record<DeformId, CardState>;
}

function card(params: Params, on = false): CardState {
  return { on, params: { ...params } };
}

/** Свежая копия дефолтов (Record требует все id — tsc ловит новые карточки). */
export function defaultParams(): BuildParams {
  return {
    profile: 'vase',
    nu: 128,
    nv: 128,
    caps: 'both',
    displace: {
      ripples: card(DEFAULT_DISPLACE_PARAMS.ripples, true),
      lissajous: card(DEFAULT_DISPLACE_PARAMS.lissajous),
      harmonics: card(DEFAULT_DISPLACE_PARAMS.harmonics),
      noise: card(DEFAULT_DISPLACE_PARAMS.noise),
      waves: card(DEFAULT_DISPLACE_PARAMS.waves),
    },
    deform: {
      twist: card(DEFAULT_DEFORM_PARAMS.twist),
      taper: card(DEFAULT_DEFORM_PARAMS.taper),
      symmetry: card(DEFAULT_DEFORM_PARAMS.symmetry),
    },
  };
}

export const DEFAULT_PARAMS: BuildParams = defaultParams();

export function buildMesh(p: BuildParams): SurfaceMesh {
  const def = profileById(p.profile);
  const grid = revolveGrid((t) => profileRadius(def, t), {
    nu: p.nu,
    nv: p.nv,
    height: def.height,
  });
  const stack: DisplaceEntry[] = [];
  for (const id of DISPLACE_IDS) {
    const card = p.displace[id];
    if (card?.on) stack.push({ fn: makeDisplace(id, card.params), weight: 1 });
  }
  if (stack.length > 0) {
    applyDisplacements(grid, gridNormals(grid), stack);
  }
  for (const id of DEFORM_IDS) {
    const card = p.deform[id];
    if (card?.on) applyDeformer(id, grid, card.params);
  }
  const { positions, indices } = assembleMesh(grid, p.caps);
  return { positions, indices, normals: meshNormals(positions, indices) };
}
