// What to say about a mesh: verdicts as message codes (translated when
// shown) and the status line. No DOM — tested in node.
//
// The gate's blockers and warnings are the kit's (`3d/validate`,
// `kit.mesh.*`): one gate for every app. The app's own are what only
// MathSculpt knows: overhangs steeper than 60° and a displacement amplitude
// larger than the profile's radius.

import type { MeshReport } from 'maker-kit/3d/validate';
import { assessExport } from 'maker-kit/3d/validate';
import type { Message, Translate } from 'maker-kit/core/message';
import type { KitKey } from 'maker-kit/i18n/index';
import type { BuildParams } from '../geo/build';
import { radiusFnFor } from '../geo/build';
import type { Key } from '../i18n';

/** The share of overhanging surface worth a warning. */
const OVERHANG_WARN = 0.02;

export interface Verdict {
  severity: 'bad' | 'warn';
  message: Message<KitKey | Key>;
}

/** The model is a solid to print: closed, or a hollow vessel with a wall (not a zero-thickness shell). */
export function shouldBeClosed(params: BuildParams): boolean {
  return params.caps === 'both' || (params.caps === 'bottom' && params.wall > 0);
}

/** The enabled displacements' amplitudes add up to more than the profile's smallest radius — the surface may cut through itself. */
function amplitudeExceedsRadius(params: BuildParams): boolean {
  const profile = radiusFnFor(params);
  if (!profile) return false;
  let budget = 0;
  for (const card of Object.values(params.displace)) if (card.on) budget += Math.abs(card.params.amp ?? 0);
  let minR = Infinity;
  for (let i = 0; i <= 100; i++) minR = Math.min(minR, profile.radiusFn(i / 100));
  return budget > minR;
}

/** The blockers, then the warnings. */
export function meshVerdicts(report: MeshReport, params: BuildParams, overhang: number): Verdict[] {
  const gate = assessExport(report, shouldBeClosed(params));
  const warnings: Verdict[] = gate.warnings.map((message) => ({ severity: 'warn', message }));
  if (overhang > OVERHANG_WARN)
    warnings.push({ severity: 'warn', message: { code: 'warn.overhang', params: { pct: Math.round(overhang * 100) } } });
  if (amplitudeExceedsRadius(params)) warnings.push({ severity: 'warn', message: { code: 'warn.amplitude' } });
  return [...gate.blockers.map((message): Verdict => ({ severity: 'bad', message })), ...warnings];
}

/** "18.6k triangles · watertight ✓ · full 256×256 · 83 ms"; `resolution` null is the preview. */
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
