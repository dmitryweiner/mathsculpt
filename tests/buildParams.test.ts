// Состояние → параметры сборки: стенка из миллиметров переводится в
// относительные единицы модели (ядро считает в них) только для полого тела
// вращения.
import { buildParamsOf, defaultState } from '../src/state/schema';
import { radiusFnFor } from '../src/geo/build';

describe('buildParamsOf', () => {
  it('сплошная модель — без стенки', () => {
    expect(buildParamsOf({ ...defaultState(), caps: 'both', wallMm: 3 }).wall).toBe(0);
  });

  it('открытый верх тела вращения: стенка мм → единицы модели', () => {
    const state = { ...defaultState(), profile: 'vase', caps: 'bottom' as const, wallMm: 3, heightMm: 150 };
    const params = buildParamsOf(state);
    const modelHeight = radiusFnFor(params)?.height ?? NaN;
    expect(params.wall).toBeCloseTo((3 * modelHeight) / 150, 12);
  });

  it('нулевая стенка — оболочка', () => {
    expect(buildParamsOf({ ...defaultState(), caps: 'bottom', wallMm: 0 }).wall).toBe(0);
  });

  it('у фигур стенки нет', () => {
    expect(buildParamsOf({ ...defaultState(), profile: 'sphere', caps: 'bottom', wallMm: 3 }).wall).toBe(0);
  });

  it('карточки, профиль и модуляция — из состояния', () => {
    const base = defaultState();
    const state = {
      ...base,
      profile: 'goblet',
      displace: { ...base.displace, noise: { on: true, params: { amp: 0.05, scale: 3, octaves: 3, seed: 1 } } },
    };
    const params = buildParamsOf(state);
    expect(params.profile).toBe('goblet');
    expect(params.displace.noise).toEqual({ on: true, params: { amp: 0.05, scale: 3, octaves: 3, seed: 1 } });
  });
});
