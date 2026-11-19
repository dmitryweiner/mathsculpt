// The geometry pipeline (plans/PLAN.md): profile → grid → displacements along
// the normals → deformers → caps → normals. A pure function of the
// parameters — used by the main thread (the preview) and the Web Worker (the
// full build).

import type { SurfaceMesh } from 'maker-kit/3d/mesh';
import { meshNormals } from 'maker-kit/3d/mesh';
import type { CapMode, Grid } from './surface';
import { assembleMesh, assembleTorusMesh, assembleHollowMesh } from './surface';
import type { ShapeId } from './shapes';
import { revolveGrid, shapeGrid, isShapeId, DEFAULT_SHAPE_PARAMS } from './shapes';
import {
  profileById,
  shapedProfileRadius,
  DEFAULT_PROFILE_SHAPE,
  FOURIER_PROFILE_ID,
  FOURIER_HEIGHT,
  DEFAULT_FOURIER_PARAMS,
  fourierRadius,
} from './profiles';
import { gridNormals } from './normals';
import type { DisplaceEntry, DisplaceId, Params } from './displace';
import { DISPLACE_IDS, DEFAULT_DISPLACE_PARAMS, applyDisplacements, makeDisplace, makeKernel } from './displace';
import type { DeformId, ParamEval } from './deform';
import { DEFORM_IDS, DEFAULT_DEFORM_PARAMS, applyDeformer } from './deform';
import type { ModState, ModContext } from './mod';
import { defaultModState, findModTarget, lfoValueAt, effectiveParam } from './mod';

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
  /** the Fourier profile's parameters (used when profile === 'fourier') */
  fourier: Params;
  /** the profile's shape adjustment: base/belly/neck (see profileShapeFactor) */
  profileShape: Params;
  /** the carrier shapes' parameters (used when profile ∈ SHAPE_IDS) */
  shapes: Record<ShapeId, Params>;
  /**
   * The wall thickness in (relative) model units. > 0 with caps='bottom' on
   * a solid of revolution → a real hollow vessel with a flat floor, a
   * watertight solid. 0 → a zero-thickness shell (vase mode). The state
   * keeps mm; buildParamsOf converts.
   */
  wall: number;
  mod: ModState;
}

export type ProgressFn = (t: number, phase: string) => void;

function card(params: Params, on = false): CardState {
  return { on, params: { ...params } };
}

/** A fresh copy of the defaults (the Record needs every id — tsc catches a new card). */
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
      gyroid: card(DEFAULT_DISPLACE_PARAMS.gyroid),
      bytebeat: card(DEFAULT_DISPLACE_PARAMS.bytebeat),
      gaussian: card(DEFAULT_DISPLACE_PARAMS.gaussian),
      phyllotaxis: card(DEFAULT_DISPLACE_PARAMS.phyllotaxis),
      cellular: card(DEFAULT_DISPLACE_PARAMS.cellular),
      warp: card(DEFAULT_DISPLACE_PARAMS.warp),
      tpms: card(DEFAULT_DISPLACE_PARAMS.tpms),
      logistic: card(DEFAULT_DISPLACE_PARAMS.logistic),
      superformula: card(DEFAULT_DISPLACE_PARAMS.superformula),
      knurl: card(DEFAULT_DISPLACE_PARAMS.knurl),
      polygon: card(DEFAULT_DISPLACE_PARAMS.polygon),
      star: card(DEFAULT_DISPLACE_PARAMS.star),
    },
    deform: {
      twist: card(DEFAULT_DEFORM_PARAMS.twist),
      taper: card(DEFAULT_DEFORM_PARAMS.taper),
      symmetry: card(DEFAULT_DEFORM_PARAMS.symmetry),
      smooth: card(DEFAULT_DEFORM_PARAMS.smooth),
      quantize: card(DEFAULT_DEFORM_PARAMS.quantize),
      bulge: card(DEFAULT_DEFORM_PARAMS.bulge),
      bend: card(DEFAULT_DEFORM_PARAMS.bend),
      shear: card(DEFAULT_DEFORM_PARAMS.shear),
      axial: card(DEFAULT_DEFORM_PARAMS.axial),
      elliptic: card(DEFAULT_DEFORM_PARAMS.elliptic),
      flare: card(DEFAULT_DEFORM_PARAMS.flare),
      corrugate: card(DEFAULT_DEFORM_PARAMS.corrugate),
      taubin: card(DEFAULT_DEFORM_PARAMS.taubin),
    },
    fourier: { ...DEFAULT_FOURIER_PARAMS },
    profileShape: { ...DEFAULT_PROFILE_SHAPE },
    shapes: {
      sphere: { ...DEFAULT_SHAPE_PARAMS.sphere },
      torus: { ...DEFAULT_SHAPE_PARAMS.torus },
      superellipsoid: { ...DEFAULT_SHAPE_PARAMS.superellipsoid },
      supershape: { ...DEFAULT_SHAPE_PARAMS.supershape },
    },
    wall: 0,
    mod: defaultModState(),
  };
}

/** A solid of revolution (not an abstract shape or the torus) — it has a profile r(z). */
export function isRevolveProfile(profile: string): boolean {
  return !isShapeId(profile) && profile !== 'torus';
}

// A flat base: the displacements fade out towards v=0 at the bottom edge (the
// first ~6% of the height). An even base for bed adhesion and a clean floor
// in a hollow vessel.
const BOTTOM_FADE = 0.06;
function bottomFade(v: number): number {
  if (v >= BOTTOM_FADE) return 1;
  const t = v / BOTTOM_FADE;
  return t * t * (3 - 2 * t); // smoothstep
}

export const DEFAULT_PARAMS: BuildParams = defaultParams();

/**
 * The profile and the height for the parameters; null for carrier shapes
 * with no profile r(z) (the sphere, the torus and the like) — the silhouette
 * graph is not drawn then.
 */
export function radiusFnFor(p: BuildParams): { radiusFn: (t: number) => number; height: number } | null {
  if (isShapeId(p.profile)) return null;
  if (p.profile === FOURIER_PROFILE_ID) {
    return { radiusFn: (t) => fourierRadius(p.fourier, t), height: FOURIER_HEIGHT };
  }
  const def = profileById(p.profile);
  return { radiusFn: (t) => shapedProfileRadius(def, p.profileShape, t), height: def.height };
}

/** The carrier grid + the height + how to assemble the mesh, for the parameters. */
function baseGrid(p: BuildParams): { grid: Grid; height: number; torus: boolean } {
  if (isShapeId(p.profile)) {
    const res = shapeGrid(p.profile, p.shapes[p.profile], p.nu, p.nv);
    return { grid: res.grid, height: res.height, torus: p.profile === 'torus' };
  }
  const prof = radiusFnFor(p);
  if (!prof) throw new Error(`no profile for ${p.profile}`);
  return {
    grid: revolveGrid(prof.radiusFn, { nu: p.nu, nv: p.nv, height: prof.height }),
    height: prof.height,
    torus: false,
  };
}

/**
 * A card's effective parameters at a point — when modulation routes lead to
 * it; otherwise undefined (the fast static path).
 */
function makeParamEval(cardId: string, base: Params, mod: ModState, ctx: ModContext): ParamEval | undefined {
  const resolved = mod.routes
    .filter((r) => r.card === cardId && r.depth !== 0 && r.src >= 0 && r.src < mod.lfos.length)
    .map((r) => ({ lfo: mod.lfos[r.src], target: findModTarget(cardId, r.param), param: r.param, depth: r.depth }))
    .flatMap((r) => (r.target ? [{ ...r, range: r.target.range, exp: r.target.exp === true }] : []));
  if (resolved.length === 0) return undefined;
  const eff: Params = { ...base };
  return (u, v, px, py, pz) => {
    for (const r of resolved) {
      const l = lfoValueAt(r.lfo, u, v, px, py, pz, ctx);
      eff[r.param] = effectiveParam(base[r.param] ?? 0, l, r.depth, r.range, r.exp);
    }
    return eff;
  };
}

/**
 * A hollow vessel of revolution: the inner shell is moved radially towards
 * the axis. Unlike a general normal offset this keeps the set horizontal
 * thickness on steep shoulders and necks and does not move the inner
 * vertices in height. The cavity's floor is raised by `wall`; the thickness
 * is clamped so as not to cross the axis.
 */
function buildHollow(grid: Grid, wallRel: number): Omit<SurfaceMesh, 'normals'> {
  const { positions } = grid;
  let zMin = Infinity;
  let minR = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    zMin = Math.min(zMin, positions[i + 2]);
    minR = Math.min(minR, Math.hypot(positions[i], positions[i + 1]));
  }
  const wall = Math.max(0, Math.min(wallRel, 0.8 * minR));
  const zFloor = zMin + wall;
  const inner = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const radius = Math.hypot(x, y);
    const scale = radius > 1e-12 ? Math.max(0.2, (radius - wall) / radius) : 0.2;
    inner[i] = x * scale;
    inner[i + 1] = y * scale;
    inner[i + 2] = Math.max(positions[i + 2], zFloor); // the cavity's flat floor
  }
  return assembleHollowMesh(grid, inner);
}

export function buildMesh(p: BuildParams, onProgress?: ProgressFn): SurfaceMesh {
  onProgress?.(0.05, 'sampling');
  const { grid, height, torus } = baseGrid(p);
  const ctx: ModContext = { height };

  const stack: DisplaceEntry[] = [];
  for (const id of DISPLACE_IDS) {
    const card = p.displace[id];
    if (!card?.on) continue;
    const evalAt = makeParamEval(id, card.params, p.mod, ctx);
    if (evalAt) {
      const kernel = makeKernel(id, card.params);
      stack.push({ fn: (u, v, px, py, pz) => kernel(u, v, px, py, pz, evalAt(u, v, px, py, pz)), weight: 1 });
    } else {
      stack.push({ fn: makeDisplace(id, card.params), weight: 1 });
    }
  }
  // A solid of revolution prints standing on its base: the displacements fade
  // at v=0 for a flat base. A sphere, torus or superfigure has no base as its
  // bottom — left as they are.
  const revolve = isRevolveProfile(p.profile);
  if (stack.length > 0) {
    const normals = gridNormals(grid);
    onProgress?.(0.15, 'displacing');
    applyDisplacements(
      grid,
      normals,
      stack,
      (j, nv) => {
        if (onProgress && j % 32 === 0) onProgress(0.15 + 0.45 * (j / nv), 'displacing');
      },
      revolve ? bottomFade : undefined,
    );
  }
  onProgress?.(0.62, 'deforming');
  for (const id of DEFORM_IDS) {
    const card = p.deform[id];
    if (card?.on) applyDeformer(id, grid, card.params, makeParamEval(id, card.params, p.mod, ctx));
  }
  onProgress?.(0.75, 'assembling');
  // polar shapes are always capped (the holes at the poles), the torus has no caps
  const caps: CapMode = isShapeId(p.profile) ? 'both' : p.caps;
  const hollow = revolve && p.caps === 'bottom' && p.wall > 0;
  const { positions, indices } = hollow ? buildHollow(grid, p.wall) : torus ? assembleTorusMesh(grid) : assembleMesh(grid, caps);
  onProgress?.(0.85, 'normals');
  const normals = meshNormals(positions, indices);
  onProgress?.(1, 'done');
  return { positions, indices, normals };
}
