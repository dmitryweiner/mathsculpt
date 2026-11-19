// The cards' UI schema: titles, descriptions, sliders and selects with their
// ranges. The arrays' order is the cards' order. The sliders' defaults must
// match the core's DEFAULT_*_PARAMS (tests/formulas.test.ts checks).
//
// Texts are dictionary keys (`card.<id>.title`, `param.<name>`,
// `option.<name>`): the kit's controls draw the cards and translate when
// they draw. Pure formula notation (`n₁`, `Yₗₘ`) is ready text (`{ text }`),
// never translated.
import type { Label } from 'maker-kit/core/message';
import type { DisplaceId } from './geo/displace';
import type { DeformId } from './geo/deform';
import type { ShapeId } from './geo/shapes';
import type { Key } from './i18n';

export interface SliderDef {
  k: string;
  label: Label<Key>;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface SelectOption {
  v: number;
  label: Key;
}

export interface SelectDef {
  k: string;
  label: Label<Key>;
  options: SelectOption[];
  value: number;
}

export interface CardDef<Id extends string = string> {
  id: Id;
  title: Key;
  tag: Label<Key>;
  desc: Key;
  selects?: SelectDef[];
  sliders: SliderDef[];
}

/** Canonical parameter metadata used by state validation and modulation. */
export function cardParamDef(card: CardDef, key: string): SliderDef | SelectDef | undefined {
  return card.sliders.find((p) => p.k === key) ?? card.selects?.find((p) => p.k === key);
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
    id: 'ripples',
    title: 'card.ripples.title',
    tag: { text: 'sin' },
    desc: 'card.ripples.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.15, step: 0.001, value: 0.02 },
      { k: 'freqU', label: 'param.wavesAround', min: 0, max: 32, step: 1, value: 12 },
      { k: 'freqV', label: 'param.wavesAlong', min: 0, max: 24, step: 0.5, value: 6 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'lissajous',
    title: 'card.lissajous.title',
    tag: { text: 'sin×sin' },
    desc: 'card.lissajous.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.15, step: 0.001, value: 0.02 },
      { k: 'freqU', label: 'param.wavesAround', min: 0, max: 32, step: 1, value: 8 },
      { k: 'freqV', label: 'param.wavesAlong', min: 0, max: 24, step: 0.5, value: 5 },
      { k: 'phaseU', label: 'param.phaseU', ...PHASE, value: 0 },
      { k: 'phaseV', label: 'param.phaseV', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'harmonics',
    title: 'card.harmonics.title',
    tag: { text: 'Yₗₘ' },
    desc: 'card.harmonics.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.2, step: 0.001, value: 0.05 },
      { k: 'l', label: 'param.degreeL', min: 0, max: 8, step: 1, value: 5 },
      { k: 'm', label: 'param.orderM', min: -8, max: 8, step: 1, value: 3 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'noise',
    title: 'card.noise.title',
    tag: { text: 'simplex' },
    desc: 'card.noise.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'scale', label: 'param.scale', min: 0.5, max: 10, step: 0.1, value: 3 },
      { k: 'octaves', label: 'param.octaves', min: 1, max: 6, step: 1, value: 3 },
      { k: 'seed', label: 'param.seed', min: 0, max: 999, step: 1, value: 42 },
    ],
  },
  {
    id: 'waves',
    title: 'card.waves.title',
    tag: { text: 'LFO' },
    desc: 'card.waves.desc',
    selects: [
      {
        k: 'shape',
        label: 'param.shape',
        value: 0,
        options: [
          { v: 0, label: 'option.triangle' },
          { v: 1, label: 'option.saw' },
          { v: 2, label: 'option.square' },
        ],
      },
    ],
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'freqU', label: 'param.wavesAround', min: 0, max: 32, step: 1, value: 8 },
      { k: 'freqV', label: 'param.wavesAlong', min: 0, max: 24, step: 0.5, value: 0 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'gyroid',
    title: 'card.gyroid.title',
    tag: { text: 'TPMS' },
    desc: 'card.gyroid.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'scale', label: 'param.scale', min: 2, max: 30, step: 0.5, value: 12 },
    ],
  },
  {
    id: 'bytebeat',
    title: 'card.bytebeat.title',
    tag: { text: '8-bit' },
    desc: 'card.bytebeat.desc',
    selects: [
      {
        k: 'recipe',
        label: 'param.recipe',
        value: 1,
        options: [
          { v: 1, label: 'option.orBands' },
          { v: 2, label: 'option.xorSquares' },
          { v: 3, label: 'option.productBits' },
          { v: 4, label: 'option.andWeave' },
        ],
      },
    ],
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.02 },
      { k: 'cells', label: 'param.cells', min: 4, max: 64, step: 1, value: 16 },
    ],
  },
  {
    id: 'gaussian',
    title: 'card.gaussian.title',
    tag: 'card.gaussian.tag',
    desc: 'card.gaussian.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'center', label: 'param.center', min: 0, max: 1, step: 0.01, value: 0.55 },
      { k: 'width', label: 'param.width', min: 0.02, max: 0.6, step: 0.01, value: 0.15 },
      { k: 'lobes', label: 'param.lobes', min: 0, max: 32, step: 1, value: 6 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'phyllotaxis',
    title: 'card.phyllotaxis.title',
    tag: { text: 'φ' },
    desc: 'card.phyllotaxis.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.12, step: 0.001, value: 0.025 },
      { k: 'turns', label: 'param.around', min: 1, max: 34, step: 1, value: 13 },
      { k: 'slope', label: 'param.along', min: -21, max: 21, step: 0.5, value: 8 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'cellular',
    title: 'card.cellular.title',
    tag: { text: 'Voronoi' },
    desc: 'card.cellular.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'scale', label: 'param.scale', min: 2, max: 24, step: 0.5, value: 8 },
      { k: 'seed', label: 'param.seed', min: 0, max: 999, step: 1, value: 17 },
      { k: 'sharpness', label: 'param.sharpness', min: 0.5, max: 8, step: 0.1, value: 2 },
    ],
  },
  {
    id: 'warp',
    title: 'card.warp.title',
    tag: 'card.warp.tag',
    desc: 'card.warp.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'scale', label: 'param.scale', min: 0.5, max: 16, step: 0.1, value: 5 },
      { k: 'warp', label: 'param.warp', min: 0, max: 2, step: 0.02, value: 0.5 },
      { k: 'seed', label: 'param.seed', min: 0, max: 999, step: 1, value: 23 },
    ],
  },
  {
    id: 'tpms',
    title: 'card.tpms.title',
    tag: { text: 'P/D/N' },
    desc: 'card.tpms.desc',
    selects: [
      {
        k: 'family',
        label: 'param.family',
        value: 1,
        options: [
          { v: 1, label: 'option.gyroid' },
          { v: 2, label: 'option.schwarzP' },
          { v: 3, label: 'option.schwarzD' },
          { v: 4, label: 'option.neovius' },
        ],
      },
    ],
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'scale', label: 'param.scale', min: 2, max: 30, step: 0.5, value: 12 },
      { k: 'sharpness', label: 'param.sharpness', min: 0.2, max: 4, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'logistic',
    title: 'card.logistic.title',
    tag: 'card.logistic.tag',
    desc: 'card.logistic.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.03 },
      { k: 'rate', label: 'param.chaosR', min: 2.5, max: 4, step: 0.005, value: 3.8 },
      { k: 'seed', label: 'param.seedX0', min: 0.01, max: 0.99, step: 0.01, value: 0.37 },
      { k: 'layers', label: 'param.layers', min: 4, max: 96, step: 1, value: 24 },
      { k: 'freqU', label: 'param.ribsAround', min: 0, max: 32, step: 1, value: 8 },
    ],
  },
  {
    id: 'superformula',
    title: 'card.superformula.title',
    tag: { text: 'Gielis' },
    desc: 'card.superformula.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'm', label: 'param.symmetryM', min: 0, max: 24, step: 1, value: 6 },
      { k: 'n1', label: { text: 'n₁' }, min: 0.1, max: 10, step: 0.1, value: 1 },
      { k: 'n2', label: { text: 'n₂' }, min: 0.1, max: 10, step: 0.1, value: 7 },
      { k: 'n3', label: { text: 'n₃' }, min: 0.1, max: 10, step: 0.1, value: 8 },
      { k: 'mix', label: 'param.mix', min: 0, max: 1, step: 0.01, value: 1 },
    ],
  },
  {
    id: 'knurl',
    title: 'card.knurl.title',
    tag: { text: '×' },
    desc: 'card.knurl.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'freqU', label: 'param.around', min: 1, max: 32, step: 1, value: 12 },
      { k: 'freqV', label: 'param.along', min: 1, max: 24, step: 0.5, value: 8 },
      { k: 'sharpness', label: 'param.sharpness', min: 0.2, max: 6, step: 0.1, value: 2 },
    ],
  },
  {
    id: 'polygon',
    title: 'card.polygon.title',
    tag: { text: 'k-gon' },
    desc: 'card.polygon.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.15, step: 0.001, value: 0.04 },
      { k: 'sides', label: 'param.sides', min: 3, max: 24, step: 1, value: 6 },
      { k: 'roundness', label: 'param.faceting', min: 0, max: 1, step: 0.01, value: 0.8 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'star',
    title: 'card.star.title',
    tag: { text: '∏cos' },
    desc: 'card.star.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.1, step: 0.001, value: 0.025 },
      { k: 'order', label: 'param.starOrder', min: 2, max: 24, step: 1, value: 8 },
      { k: 'freqV', label: 'param.along', min: 0, max: 16, step: 0.5, value: 5 },
      { k: 'layers', label: 'param.layers', min: 1, max: 4, step: 1, value: 3 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
];

/** The carrier shapes' parameter cards (no switch; shown for the chosen shape). */
export const SHAPE_CARDS: CardDef<ShapeId>[] = [
  {
    id: 'torus',
    title: 'card.torus.title',
    tag: { text: 'R, r' },
    desc: 'card.torus.desc',
    sliders: [
      { k: 'R', label: 'param.ringRadius', min: 0.1, max: 0.5, step: 0.005, value: 0.35 },
      { k: 'r', label: 'param.tubeRadius', min: 0.05, max: 0.3, step: 0.005, value: 0.15 },
    ],
  },
  {
    id: 'superellipsoid',
    title: 'card.superellipsoid.title',
    tag: { text: 'e1, e2' },
    desc: 'card.superellipsoid.desc',
    sliders: [
      { k: 'e1', label: 'param.exponentE1', min: 0.1, max: 3, step: 0.05, value: 1 },
      { k: 'e2', label: 'param.exponentE2', min: 0.1, max: 3, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'supershape',
    title: 'card.supershape.title',
    tag: { text: 'Gielis' },
    desc: 'card.supershape.desc',
    sliders: [
      { k: 'm1', label: 'param.m1Around', min: 0, max: 16, step: 1, value: 6 },
      { k: 'n11', label: { text: 'n₁·1' }, min: 0.1, max: 10, step: 0.1, value: 1 },
      { k: 'n12', label: { text: 'n₂·1' }, min: 0.1, max: 10, step: 0.1, value: 7 },
      { k: 'n13', label: { text: 'n₃·1' }, min: 0.1, max: 10, step: 0.1, value: 8 },
      { k: 'm2', label: 'param.m2Along', min: 0, max: 16, step: 1, value: 4 },
      { k: 'n21', label: { text: 'n₁·2' }, min: 0.1, max: 10, step: 0.1, value: 10 },
      { k: 'n22', label: { text: 'n₂·2' }, min: 0.1, max: 10, step: 0.1, value: 10 },
      { k: 'n23', label: { text: 'n₃·2' }, min: 0.1, max: 10, step: 0.1, value: 10 },
    ],
  },
];

/**
 * The profile's shape card (vase, amphora, …): radius factors by zones. No
 * switch; shown for a profile.
 */
export const PROFILE_SHAPE_CARD: CardDef = {
  id: 'profileShape',
  title: 'card.profileShape.title',
  tag: { text: 'r(z)' },
  desc: 'card.profileShape.desc',
  sliders: [
    { k: 'base', label: 'param.base', min: -0.6, max: 1, step: 0.02, value: 0 },
    { k: 'belly', label: 'param.belly', min: -0.6, max: 1, step: 0.02, value: 0 },
    { k: 'neck', label: 'param.neck', min: -0.6, max: 1.5, step: 0.02, value: 0 },
  ],
};

/** The Fourier profile's card (no switch; shown when profile = fourier). */
export const FOURIER_CARD: CardDef = {
  id: 'fourier',
  title: 'card.fourier.title',
  tag: { text: 'r(z)' },
  desc: 'card.fourier.desc',
  sliders: [
    { k: 'r0', label: 'param.baseRadius', min: 0.05, max: 0.6, step: 0.005, value: 0.3 },
    { k: 'a1', label: 'param.harmonic1', min: -0.3, max: 0.3, step: 0.005, value: 0.12 },
    { k: 'phi1', label: 'param.phase1', ...PHASE, value: 0 },
    { k: 'a2', label: 'param.harmonic2', min: -0.3, max: 0.3, step: 0.005, value: 0.06 },
    { k: 'phi2', label: 'param.phase2', ...PHASE, value: 0 },
    { k: 'a3', label: 'param.harmonic3', min: -0.3, max: 0.3, step: 0.005, value: 0 },
    { k: 'phi3', label: 'param.phase3', ...PHASE, value: 0 },
  ],
};

export const DEFORM_CARDS: CardDef<DeformId>[] = [
  {
    id: 'twist',
    title: 'card.twist.title',
    tag: 'card.twist.tag',
    desc: 'card.twist.desc',
    sliders: [{ k: 'turns', label: 'param.turns', min: -2, max: 2, step: 0.01, value: 0.25 }],
  },
  {
    id: 'taper',
    title: 'card.taper.title',
    tag: 'card.taper.tag',
    desc: 'card.taper.desc',
    sliders: [
      { k: 'amount', label: 'param.amount', min: -1, max: 0.95, step: 0.01, value: 0.3 },
      { k: 'power', label: 'param.power', min: 0.3, max: 3, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'symmetry',
    title: 'card.symmetry.title',
    tag: 'card.symmetry.tag',
    desc: 'card.symmetry.desc',
    sliders: [
      { k: 'k', label: 'param.foldK', min: 1, max: 12, step: 1, value: 6 },
      { k: 'mix', label: 'param.mix', min: 0, max: 1, step: 0.01, value: 1 },
    ],
  },
  {
    id: 'smooth',
    title: 'card.smooth.title',
    tag: { text: 'laplace' },
    desc: 'card.smooth.desc',
    sliders: [
      { k: 'iterations', label: 'param.iterations', min: 1, max: 5, step: 1, value: 2 },
      { k: 'strength', label: 'param.strength', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
  },
  {
    id: 'quantize',
    title: 'card.quantize.title',
    tag: 'card.quantize.tag',
    desc: 'card.quantize.desc',
    sliders: [{ k: 'step', label: 'param.step', min: 0.002, max: 0.1, step: 0.002, value: 0.02 }],
  },
  {
    id: 'bulge',
    title: 'card.bulge.title',
    tag: { text: 'Gaussian' },
    desc: 'card.bulge.desc',
    sliders: [
      { k: 'amount', label: 'param.amount', min: -0.8, max: 1.5, step: 0.01, value: 0.25 },
      { k: 'center', label: 'param.center', min: 0, max: 1, step: 0.01, value: 0.5 },
      { k: 'width', label: 'param.width', min: 0.02, max: 0.6, step: 0.01, value: 0.2 },
    ],
  },
  {
    id: 'bend',
    title: 'card.bend.title',
    tag: 'card.bend.tag',
    desc: 'card.bend.desc',
    sliders: [
      { k: 'amount', label: 'param.amount', min: -1, max: 1, step: 0.01, value: 0.2 },
      { k: 'power', label: 'param.power', min: 0.2, max: 4, step: 0.05, value: 1 },
    ],
  },
  {
    id: 'shear',
    title: 'card.shear.title',
    tag: { text: 'xy' },
    desc: 'card.shear.desc',
    sliders: [
      { k: 'x', label: 'param.xShift', min: -0.8, max: 0.8, step: 0.01, value: 0.15 },
      { k: 'y', label: 'param.yShift', min: -0.8, max: 0.8, step: 0.01, value: 0 },
    ],
  },
  {
    id: 'axial',
    title: 'card.axial.title',
    tag: 'card.axial.tag',
    desc: 'card.axial.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.3, step: 0.005, value: 0.08 },
      { k: 'freq', label: 'param.turns', min: -8, max: 8, step: 0.1, value: 2 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'elliptic',
    title: 'card.elliptic.title',
    tag: { text: 'a:b' },
    desc: 'card.elliptic.desc',
    sliders: [
      { k: 'ratio', label: 'param.axisRatio', min: 0.3, max: 3, step: 0.02, value: 1.3 },
      { k: 'phase', label: 'param.direction', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'flare',
    title: 'card.flare.title',
    tag: 'card.flare.tag',
    desc: 'card.flare.desc',
    sliders: [
      { k: 'amount', label: 'param.amount', min: -0.8, max: 1.5, step: 0.01, value: 0.3 },
      { k: 'start', label: 'param.start', min: 0, max: 0.95, step: 0.01, value: 0.75 },
      { k: 'power', label: 'param.power', min: 0.2, max: 4, step: 0.05, value: 1.5 },
    ],
  },
  {
    id: 'corrugate',
    title: 'card.corrugate.title',
    tag: 'card.corrugate.tag',
    desc: 'card.corrugate.desc',
    sliders: [
      { k: 'amp', label: 'param.amplitude', min: 0, max: 0.3, step: 0.005, value: 0.05 },
      { k: 'folds', label: 'param.folds', min: 2, max: 48, step: 1, value: 12 },
      { k: 'phase', label: 'param.phase', ...PHASE, value: 0 },
    ],
  },
  {
    id: 'taubin',
    title: 'card.taubin.title',
    tag: { text: 'λ/μ' },
    desc: 'card.taubin.desc',
    sliders: [
      { k: 'iterations', label: 'param.iterations', min: 1, max: 8, step: 1, value: 2 },
      { k: 'lambda', label: 'param.lambda', min: 0.05, max: 1, step: 0.01, value: 0.5 },
      { k: 'mu', label: 'param.mu', min: -1, max: -0.01, step: 0.01, value: -0.53 },
    ],
  },
];

/** All cards that declare serializable numeric parameters. */
export const PARAMETER_CARDS: readonly CardDef[] = [...DISPLACE_CARDS, ...DEFORM_CARDS, PROFILE_SHAPE_CARD, FOURIER_CARD, ...SHAPE_CARDS];

export function findParameterCard(id: string): CardDef | undefined {
  return PARAMETER_CARDS.find((card) => card.id === id);
}
