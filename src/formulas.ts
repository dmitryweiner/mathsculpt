// UI-схема карточек: заголовки, описания, слайдеры/селекты с диапазонами.
// Порядок массивов = порядок карточек. Дефолты слайдеров обязаны совпадать
// с DEFAULT_*_PARAMS ядра (сверяется тестом formulas.test.ts).
import type { DisplaceId } from './geo/displace';
import type { DeformId } from './geo/deform';

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
];

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
];
