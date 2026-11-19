// Что сказать о меше: вердикты кодами сообщений (переводятся при показе) и
// строка статуса. Без DOM — проверяется в node.
//
// Блокировки и предупреждения сита — китовые (`3d/validate`, `kit.mesh.*`):
// одно сито у всех приложений. Свои — то, что знает только MathSculpt:
// свесы круче 60° и амплитуда смещений больше радиуса профиля.

import type { MeshReport } from 'maker-kit/3d/validate';
import { assessExport } from 'maker-kit/3d/validate';
import type { Message, Translate } from 'maker-kit/core/message';
import type { KitKey } from 'maker-kit/i18n/index';
import type { BuildParams } from '../geo/build';
import { radiusFnFor } from '../geo/build';
import type { Key } from '../i18n';

/** Доля нависающей поверхности, с которой стоит предупредить. */
const OVERHANG_WARN = 0.02;

export interface Verdict {
  severity: 'bad' | 'warn';
  message: Message<KitKey | Key>;
}

/** Модель — сплошное тело для печати: закрытая, или полый сосуд со стенкой (не оболочка нулевой толщины). */
export function shouldBeClosed(params: BuildParams): boolean {
  return params.caps === 'both' || (params.caps === 'bottom' && params.wall > 0);
}

/** Сумма амплитуд включённых смещений больше наименьшего радиуса профиля — поверхность может пройти сквозь себя. */
function amplitudeExceedsRadius(params: BuildParams): boolean {
  const profile = radiusFnFor(params);
  if (!profile) return false;
  let budget = 0;
  for (const card of Object.values(params.displace)) if (card.on) budget += Math.abs(card.params.amp ?? 0);
  let minR = Infinity;
  for (let i = 0; i <= 100; i++) minR = Math.min(minR, profile.radiusFn(i / 100));
  return budget > minR;
}

/** Блокировки, затем предупреждения. */
export function meshVerdicts(report: MeshReport, params: BuildParams, overhang: number): Verdict[] {
  const gate = assessExport(report, shouldBeClosed(params));
  const warnings: Verdict[] = gate.warnings.map((message) => ({ severity: 'warn', message }));
  if (overhang > OVERHANG_WARN)
    warnings.push({ severity: 'warn', message: { code: 'warn.overhang', params: { pct: Math.round(overhang * 100) } } });
  if (amplitudeExceedsRadius(params)) warnings.push({ severity: 'warn', message: { code: 'warn.amplitude' } });
  return [...gate.blockers.map((message): Verdict => ({ severity: 'bad', message })), ...warnings];
}

/** «18.6k triangles · watertight ✓ · full 256×256 · 83 ms»; `resolution` null — превью. */
export function statusText(
  report: MeshReport,
  params: BuildParams,
  build: { resolution: number | null; ms: number },
  t: Translate<Key>,
): string {
  const closed = shouldBeClosed(params) ? t(report.watertight ? 'status.watertight' : 'status.notWatertight') : t('status.shell');
  return t('status.line', {
    k: (report.triangleCount / 1000).toFixed(1),
    closed,
    build: build.resolution === null ? t('status.preview') : t('status.full', { n: build.resolution }),
    ms: Math.round(build.ms),
  });
}
