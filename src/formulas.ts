// UI-схема карточек: заголовки, описания, слайдеры/селекты с диапазонами.
// Порядок массивов = порядок карточек. Дефолты слайдеров обязаны совпадать
// с DEFAULT_*_PARAMS ядра (сверяется тестом formulas.test.ts).
import type { DisplaceId } from './geo/displace';
import type { DeformId } from './geo/deform';
import type { ShapeId } from './geo/shapes';

export interface SliderDef {
  k: string;
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface SelectOption {
  v: number;
  label: string;
}

export interface SelectDef {
  k: string;
  name: string;
  options: SelectOption[];
  value: number;
}

export interface CardDef<Id extends string = string> {
  id: Id;
  title: string;
  tag: string;
  desc: string;
  selects?: SelectDef[];
  sliders: SliderDef[];
}

/** Canonical parameter metadata used by state validation and modulation. */
export function cardParamDef(
  card: CardDef,
  key: string,
): SliderDef | SelectDef | undefined {
  return card.sliders.find((p) => p.k === key) ??
    card.selects?.find((p) => p.k === key);
}

export function clampCardParam(card: CardDef, key: string, value: number): number | undefined {
  const def = cardParamDef(card, key);
  if (!def || !Number.isFinite(value)) return undefined;
  if ('options' in def) {
    return def.options.some((option) => option.v === value) ? value : def.value;
  }
  return Math.max(def.min, Math.min(def.max, value));
}

const PHASE = { min: 0, max: 6.283, step: 0.01 };

export const DISPLACE_CARDS: CardDef<DisplaceId>[] = [
  {
    id: 'ripples', title: 'Ripples', tag: 'sin', desc: 'A·sin(a·u + b·v + φ) — rings, flutes, spirals',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.15, step: 0.001, value: 0.02 },
      { k: 'freqU', name: 'Waves around', min: 0, max: 32, step: 1, value: 12 },
      { k: 'freqV', name: 'Waves along', min: 0, max: 24, step: 0.5, value: 6 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'lissajous', title: 'Lissajous weave', tag: 'sin×sin', desc: 'A·sin(a·u+φ₁)·sin(b·v+φ₂) — basket / waffle',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.15, step: 0.001, value: 0.02 },
      { k: 'freqU', name: 'Waves around', min: 0, max: 32, step: 1, value: 8 },
      { k: 'freqV', name: 'Waves along', min: 0, max: 24, step: 0.5, value: 5 },
      { k: 'phaseU', name: 'Phase u', ...PHASE, value: 0 },
      { k: 'phaseV', name: 'Phase v', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'harmonics', title: 'Spherical harmonics', tag: 'Yₗₘ', desc: 'A·Yₗₘ(θ, φ) — organic petals',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.2, step: 0.001, value: 0.05 },
      { k: 'l', name: 'Degree l', min: 0, max: 8, step: 1, value: 5 },
      { k: 'm', name: 'Order m', min: -8, max: 8, step: 1, value: 3 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'noise', title: 'fBm noise', tag: 'simplex', desc: 'A·Σ noise(2ᵏ·P)/2ᵏ — stone, bark, hand-thrown clay',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'scale', name: 'Scale', min: 0.5, max: 10, step: 0.1, value: 3 },
      { k: 'octaves', name: 'Octaves', min: 1, max: 6, step: 1, value: 3 },
      { k: 'seed', name: 'Seed', min: 0, max: 999, step: 1, value: 42 },
    ],
  },
  {
    id: 'waves', title: 'Waves', tag: 'LFO', desc: 'triangle / saw / square as direct relief — gears, crowns, ziggurats',
    selects: [
      { k: 'shape', name: 'Shape', value: 0, options: [
        { v: 0, label: 'Triangle' },
        { v: 1, label: 'Saw' },
        { v: 2, label: 'Square' },
      ] },
    ],
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'freqU', name: 'Waves around', min: 0, max: 32, step: 1, value: 8 },
      { k: 'freqV', name: 'Waves along', min: 0, max: 24, step: 0.5, value: 0 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'gyroid', title: 'Gyroid pattern', tag: 'TPMS', desc: 'sin x·cos y + sin y·cos z + sin z·cos x at surface point — woven relief',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'scale', name: 'Scale', min: 2, max: 30, step: 0.5, value: 12 },
    ],
  },
  {
    id: 'bytebeat', title: 'Bytebeat relief', tag: '8-bit', desc: 'integer formulas over (u,v) cells — pixel ornament',
    selects: [
      { k: 'recipe', name: 'Recipe', value: 1, options: [
        { v: 1, label: 'OR bands' },
        { v: 2, label: 'XOR squares' },
        { v: 3, label: 'Product bits' },
        { v: 4, label: 'AND weave' },
      ] },
    ],
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'cells', name: 'Cells', min: 4, max: 64, step: 1, value: 16 },
    ],
  },
  {
    id: 'gaussian', title: 'Gaussian rings', tag: 'local', desc: 'localized lobes with a Gaussian height envelope',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'center', name: 'Center', min: 0, max: 1, step: 0.01, value: 0.55 },
      { k: 'width', name: 'Width', min: 0.02, max: 0.6, step: 0.01, value: 0.15 },
      { k: 'lobes', name: 'Lobes', min: 0, max: 32, step: 1, value: 6 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'phyllotaxis', title: 'Phyllotaxis', tag: 'φ', desc: 'botanical and Fibonacci-like spiral ribs',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.12, step: 0.001, value: 0.025 },
      { k: 'turns', name: 'Around', min: 1, max: 34, step: 1, value: 13 },
      { k: 'slope', name: 'Along', min: -21, max: 21, step: 0.5, value: 8 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'cellular', title: 'Cellular relief', tag: 'Voronoi', desc: 'seeded 3D cellular edges — shell, stone, cracked glaze',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'scale', name: 'Scale', min: 2, max: 24, step: 0.5, value: 8 },
      { k: 'seed', name: 'Seed', min: 0, max: 999, step: 1, value: 17 },
      { k: 'sharpness', name: 'Sharpness', min: 0.5, max: 8, step: 0.1, value: 2 },
    ],
  },
  {
    id: 'warp', title: 'Warped noise', tag: 'domain', desc: 'domain-warped simplex — marble, wood and flowing clay',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'scale', name: 'Scale', min: 0.5, max: 16, step: 0.1, value: 5 },
      { k: 'warp', name: 'Warp', min: 0, max: 2, step: 0.02, value: 0.5 },
      { k: 'seed', name: 'Seed', min: 0, max: 999, step: 1, value: 23 },
    ],
  },
  {
    id: 'tpms', title: 'TPMS family', tag: 'P/D/N', desc: 'Gyroid, Schwarz P/D and Neovius implicit fields as relief',
    selects: [{ k: 'family', name: 'Family', value: 1, options: [
      { v: 1, label: 'Gyroid' }, { v: 2, label: 'Schwarz P' },
      { v: 3, label: 'Schwarz D' }, { v: 4, label: 'Neovius' },
    ] }],
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'scale', name: 'Scale', min: 2, max: 30, step: 0.5, value: 12 },
      { k: 'sharpness', name: 'Sharpness', min: 0.2, max: 4, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'logistic', title: 'Logistic ribs', tag: 'chaos', desc: 'xₙ₊₁=r·xₙ(1−xₙ), interpolated over height',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'rate', name: 'Chaos r', min: 2.5, max: 4, step: 0.005, value: 3.8 },
      { k: 'seed', name: 'Seed x₀', min: 0.01, max: 0.99, step: 0.01, value: 0.37 },
      { k: 'layers', name: 'Layers', min: 4, max: 96, step: 1, value: 24 },
      { k: 'freqU', name: 'Ribs around', min: 0, max: 32, step: 1, value: 8 },
    ],
  },
  {
    id: 'superformula', title: 'Superformula section', tag: 'Gielis', desc: 'flower and star cross-sections on any carrier',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'm', name: 'Symmetry m', min: 0, max: 24, step: 1, value: 6 },
      { k: 'n1', name: 'n₁', min: 0.1, max: 10, step: 0.1, value: 1 },
      { k: 'n2', name: 'n₂', min: 0.1, max: 10, step: 0.1, value: 7 },
      { k: 'n3', name: 'n₃', min: 0.1, max: 10, step: 0.1, value: 8 },
      { k: 'mix', name: 'Mix', min: 0, max: 1, step: 0.01, value: 1 },
    ],
  },
  {
    id: 'knurl', title: 'Diamond knurl', tag: '×', desc: 'crossed helical waves for woven and mechanical texture',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'freqU', name: 'Around', min: 1, max: 32, step: 1, value: 12 },
      { k: 'freqV', name: 'Along', min: 1, max: 24, step: 0.5, value: 8 },
      { k: 'sharpness', name: 'Sharpness', min: 0.2, max: 6, step: 0.1, value: 2 },
    ],
  },
  {
    id: 'polygon', title: 'Polygon facets', tag: 'k-gon', desc: 'exact regular-polygon radial factor with rounded mixing',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'sides', name: 'Sides', min: 3, max: 24, step: 1, value: 6 },
      { k: 'roundness', name: 'Faceting', min: 0, max: 1, step: 0.01, value: 0.8 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'star', title: 'Star interference', tag: '∏cos', desc: 'layered geometric star and lattice ornament',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'order', name: 'Star order', min: 2, max: 24, step: 1, value: 8 },
      { k: 'freqV', name: 'Along', min: 0, max: 16, step: 0.5, value: 5 },
      { k: 'layers', name: 'Layers', min: 1, max: 4, step: 1, value: 3 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
];

/** Карточки параметров фигур-носителей (без чекбокса; видны при выборе фигуры). */
export const SHAPE_CARDS: CardDef<ShapeId>[] = [
  {
    id: 'torus', title: 'Torus', tag: 'R, r', desc: '(R + r·cos v)·(cos u, sin u), r·sin v',
    sliders: [
      { k: 'R', name: 'Ring radius', min: 0.1, max: 0.5, step: 0.005, value: 0.35 },
      { k: 'r', name: 'Tube radius', min: 0.05, max: 0.3, step: 0.005, value: 0.15 },
    ],
  },
  {
    id: 'superellipsoid', title: 'Superellipsoid', tag: 'e1, e2', desc: 'spherical product of superellipses: cube ↔ sphere ↔ octahedron ↔ star',
    sliders: [
      { k: 'e1', name: 'Exponent e1', min: 0.1, max: 3, step: 0.05, value: 1 },
      { k: 'e2', name: 'Exponent e2', min: 0.1, max: 3, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'supershape', title: 'Supershape', tag: 'Gielis', desc: 'r(φ) = (|cos(mφ/4)|^n₂ + |sin(mφ/4)|^n₃)^(−1/n₁), two sets multiplied',
    sliders: [
      { k: 'm1', name: 'm₁ (around)', min: 0, max: 16, step: 1, value: 6 },
      { k: 'n11', name: 'n₁·1', min: 0.1, max: 10, step: 0.1, value: 1 },
      { k: 'n12', name: 'n₂·1', min: 0.1, max: 10, step: 0.1, value: 7 },
      { k: 'n13', name: 'n₃·1', min: 0.1, max: 10, step: 0.1, value: 8 },
      { k: 'm2', name: 'm₂ (along)', min: 0, max: 16, step: 1, value: 4 },
      { k: 'n21', name: 'n₁·2', min: 0.1, max: 10, step: 0.1, value: 10 },
      { k: 'n22', name: 'n₂·2', min: 0.1, max: 10, step: 0.1, value: 10 },
      { k: 'n23', name: 'n₃·2', min: 0.1, max: 10, step: 0.1, value: 10 },
    ],
  },
];

/**
 * Карточка настройки формы пресет-профиля (ваза/амфора/…): множители радиуса
 * по зонам. Без чекбокса; видна при выборе пресет-профиля.
 */
export const PROFILE_SHAPE_CARD: CardDef = {
  id: 'profileShape', title: 'Profile shape', tag: 'r(z)', desc: 'widen / narrow the base, belly and neck of the profile',
  sliders: [
    { k: 'base', name: 'Base', min: -0.6, max: 1, step: 0.02, value: 0 },
    { k: 'belly', name: 'Belly', min: -0.6, max: 1, step: 0.02, value: 0 },
    { k: 'neck', name: 'Neck', min: -0.6, max: 1.5, step: 0.02, value: 0 },
  ],
};

/** Карточка Фурье-профиля (без чекбокса; видна при profile = fourier). */
export const FOURIER_CARD: CardDef = {
  id: 'fourier', title: 'Fourier profile', tag: 'r(z)', desc: 'r(z) = r₀ + Σ aₖ·sin(kπz + φₖ)',
  sliders: [
    { k: 'r0', name: 'Base radius', min: 0.05, max: 0.6, step: 0.005, value: 0.3 },
    { k: 'a1', name: 'Harmonic 1', min: -0.3, max: 0.3, step: 0.005, value: 0.12 },
    { k: 'phi1', name: 'Phase 1', ...PHASE, value: 0 },
    { k: 'a2', name: 'Harmonic 2', min: -0.3, max: 0.3, step: 0.005, value: 0.06 },
    { k: 'phi2', name: 'Phase 2', ...PHASE, value: 0 },
    { k: 'a3', name: 'Harmonic 3', min: -0.3, max: 0.3, step: 0.005, value: 0 },
    { k: 'phi3', name: 'Phase 3', ...PHASE, value: 0 },
  ],
};

export const DEFORM_CARDS: CardDef<DeformId>[] = [
  {
    id: 'twist', title: 'Twist', tag: 'spiral', desc: 'rotate section by 2π·turns along height',
    sliders: [
      { k: 'turns', name: 'Turns', min: -2, max: 2, step: 0.01, value: 0.25 },
    ],
  },
  {
    id: 'taper', title: 'Taper', tag: 'narrow', desc: 'scale section by 1 − amount·vᵖ',
    sliders: [
      { k: 'amount', name: 'Amount', min: -1, max: 0.95, step: 0.01, value: 0.3 },
      { k: 'power', name: 'Power', min: 0.3, max: 3, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'symmetry', title: 'Symmetry k-fold', tag: 'pottery', desc: 'average over rotations by 2π/k',
    sliders: [
      { k: 'k', name: 'Fold k', min: 1, max: 12, step: 1, value: 6 },
      { k: 'mix', name: 'Mix', min: 0, max: 1, step: 0.01, value: 1 },
    ],
  },
  {
    id: 'smooth', title: 'Smooth', tag: 'laplace', desc: 'Laplacian mesh smoothing, 1–5 iterations',
    sliders: [
      { k: 'iterations', name: 'Iterations', min: 1, max: 5, step: 1, value: 2 },
      { k: 'strength', name: 'Strength', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
  },
  {
    id: 'quantize', title: 'Quantize', tag: 'voxel', desc: 'snap positions to a grid step — voxel / low-poly look',
    sliders: [
      { k: 'step', name: 'Step', min: 0.002, max: 0.1, step: 0.002, value: 0.02 },
    ],
  },
  {
    id: 'bulge', title: 'Bulge / Pinch', tag: 'Gaussian', desc: 'localized radial swelling or pinching',
    sliders: [
      { k: 'amount', name: 'Amount', min: -0.8, max: 1.5, step: 0.01, value: 0.25 },
      { k: 'center', name: 'Center', min: 0, max: 1, step: 0.01, value: 0.5 },
      { k: 'width', name: 'Width', min: 0.02, max: 0.6, step: 0.01, value: 0.2 },
    ],
  },
  {
    id: 'bend', title: 'Bend', tag: 'lean', desc: 'bend the centerline sideways along height',
    sliders: [
      { k: 'amount', name: 'Amount', min: -1, max: 1, step: 0.01, value: 0.2 },
      { k: 'power', name: 'Power', min: 0.2, max: 4, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'shear', title: 'Shear / Slant', tag: 'xy', desc: 'linearly slant rings along height',
    sliders: [
      { k: 'x', name: 'X shift', min: -0.8, max: 0.8, step: 0.01, value: 0.15 },
      { k: 'y', name: 'Y shift', min: -0.8, max: 0.8, step: 0.01, value: 0 },
    ],
  },
  {
    id: 'axial', title: 'Axial wave', tag: 'centerline', desc: 'move ring centers along a spatial helix',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.3, step: 0.005, value: 0.08 },
      { k: 'freq', name: 'Turns', min: -8, max: 8, step: 0.1, value: 2 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'elliptic', title: 'Elliptic section', tag: 'a:b', desc: 'turn circular sections into rotated ellipses',
    sliders: [
      { k: 'ratio', name: 'Axis ratio', min: 0.3, max: 3, step: 0.02, value: 1.3 },
      { k: 'phase', name: 'Direction', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'flare', title: 'Neck flare', tag: 'rim', desc: 'smoothly flare or close the upper part',
    sliders: [
      { k: 'amount', name: 'Amount', min: -0.8, max: 1.5, step: 0.01, value: 0.3 },
      { k: 'start', name: 'Start', min: 0, max: 0.95, step: 0.01, value: 0.75 },
      { k: 'power', name: 'Power', min: 0.2, max: 4, step: 0.05, value: 1.5 },
    ],
  },
  {
    id: 'corrugate', title: 'Corrugation', tag: 'folds', desc: 'radial structural folds around the section',
    sliders: [
      { k: 'amp', name: 'Amplitude', min: 0, max: 0.3, step: 0.005, value: 0.05 },
      { k: 'folds', name: 'Folds', min: 2, max: 48, step: 1, value: 12 },
      { k: 'phase', name: 'Phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'taubin', title: 'Taubin smooth', tag: 'λ/μ', desc: 'two-pass smoothing with much less shrinkage',
    sliders: [
      { k: 'iterations', name: 'Iterations', min: 1, max: 8, step: 1, value: 2 },
      { k: 'lambda', name: 'Lambda', min: 0.05, max: 1, step: 0.01, value: 0.5 },
      { k: 'mu', name: 'Mu', min: -1, max: -0.01, step: 0.01, value: -0.53 },
    ],
  },
];

/** All cards that declare serializable numeric parameters. */
export const PARAMETER_CARDS: readonly CardDef[] = [
  ...DISPLACE_CARDS,
  ...DEFORM_CARDS,
  PROFILE_SHAPE_CARD,
  FOURIER_CARD,
  ...SHAPE_CARDS,
];

export function findParameterCard(id: string): CardDef | undefined {
  return PARAMETER_CARDS.find((card) => card.id === id);
}
