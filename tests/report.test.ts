// Вердикты меша кодами сообщений: сито экспорта кита (блокировки и
// предупреждения) плюс свои — свесы и амплитуда больше радиуса; строка
// статуса словами словаря.
import { validateMesh } from 'maker-kit/3d/validate';
import type { MeshReport } from 'maker-kit/3d/validate';
import { buildMesh } from '../src/geo/build';
import { buildParamsOf, defaultState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { meshVerdicts, shouldBeClosed, statusText } from '../src/ui/report';
import { t } from '../src/i18n';

const SOLID: MeshReport = {
  finite: true,
  indicesValid: true,
  watertight: true,
  volume: 1,
  bbox: { min: [0, 0, 0], max: [1, 1, 1] },
  degenerateTriangles: 0,
  triangleCount: 18600,
  vertexCount: 9300,
  extents: [1, 1, 1],
};

const codes = (state: AppState, report: MeshReport, overhang = 0): string[] =>
  meshVerdicts(report, buildParamsOf(state), overhang).map((v) => `${v.severity}:${v.message.code}`);

describe('вердикты меша', () => {
  it('сплошная модель по умолчанию строится без замечаний', () => {
    const params = { ...buildParamsOf(defaultState()), nu: 48, nv: 48 };
    expect(meshVerdicts(validateMesh(buildMesh(params)), params, 0)).toEqual([]);
  });

  it('незамкнутое тело, которое должно быть сплошным, — блокировка кита', () => {
    expect(codes(defaultState(), { ...SOLID, watertight: false })).toEqual(['bad:kit.mesh.open']);
  });

  it('оболочка нулевой толщины может быть незамкнутой', () => {
    const shell = { ...defaultState(), caps: 'bottom' as const, wallMm: 0 };
    expect(shouldBeClosed(buildParamsOf(shell))).toBe(false);
    expect(codes(shell, { ...SOLID, watertight: false })).toEqual([]);
    expect(shouldBeClosed(buildParamsOf({ ...shell, wallMm: 2 }))).toBe(true);
  });

  it('свесы круче 60° больше 2 % — предупреждение с долей', () => {
    const [verdict] = meshVerdicts(SOLID, buildParamsOf(defaultState()), 0.05);
    expect(verdict).toEqual({ severity: 'warn', message: { code: 'warn.overhang', params: { pct: 5 } } });
    expect(codes(defaultState(), SOLID, 0.02)).toEqual([]);
  });

  it('амплитуда смещений больше радиуса — предупреждение о самопересечении', () => {
    const base = defaultState();
    const big = {
      ...base,
      displace: {
        ...base.displace,
        ripples: { on: true, params: { ...base.displace.ripples?.params, amp: 0.15 } },
        noise: { on: true, params: { ...base.displace.noise?.params, amp: 0.1 } },
      },
    };
    expect(codes(big, SOLID)).toContain('warn:warn.amplitude');
  });

  it('блокировки впереди предупреждений', () => {
    const severities = meshVerdicts({ ...SOLID, finite: false }, buildParamsOf(defaultState()), 0.5).map((v) => v.severity);
    expect(severities).toEqual(['bad', 'warn']);
  });
});

describe('строка статуса', () => {
  it('превью сплошной модели', () => {
    expect(statusText(SOLID, buildParamsOf(defaultState()), { resolution: null, ms: 9.6 }, t)).toBe(
      '18.6k triangles · watertight ✓ · preview · 10 ms',
    );
  });

  it('полная сборка незамкнутого тела', () => {
    expect(statusText({ ...SOLID, watertight: false }, buildParamsOf(defaultState()), { resolution: 256, ms: 83 }, t)).toBe(
      '18.6k triangles · NOT watertight ✗ · full 256×256 · 83 ms',
    );
  });

  it('оболочка', () => {
    const shell = buildParamsOf({ ...defaultState(), caps: 'bottom', wallMm: 0 });
    expect(statusText(SOLID, shell, { resolution: null, ms: 5 }, t)).toBe('18.6k triangles · open top (zero-wall shell) · preview · 5 ms');
  });
});
