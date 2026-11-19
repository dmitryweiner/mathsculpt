// Сборка UI: топбар (пресеты, Save, Share, Export), панель на контролах
// кита (строки «Shape», карточки носителя, смещений, деформеров, модуляции),
// график r(z). Состояние одно и неизменяемое — то, что держит история кита:
// правка панели — новое состояние, `final` делает её шагом отмены.
// Превью 96×96 строится в главном потоке мгновенно; полная сетка — в
// Web Worker с прогресс-баром (паттерн mandelbulb-worker).
import 'maker-kit/styles/kit.css';
import './style.css';
import { History } from 'maker-kit/core/history';
import type { PresetRef } from 'maker-kit/core/presets';
import { isPresetRef, nextPresetName, presetRef as makePresetRef } from 'maker-kit/core/presets';
import { browserStorage, loadRecord, saveRecord } from 'maker-kit/core/storage';
import type { Control } from 'maker-kit/ui/controls';
import { renderControls } from 'maker-kit/ui/controls';
import { el } from 'maker-kit/ui/dom';
import type { BuildParams } from './geo/build';
import { buildMesh, radiusFnFor } from './geo/build';
import type { SurfaceMesh } from './geo/surface';
import { validateMesh, overhangFraction, assessExport } from './geo/validate';
import type { MeshReport } from './geo/validate';
import { encodeSTL } from './geo/stl';
import { createScene } from './render/scene';
import { drawProfileGraph } from './ui/graph';
import { renderPanel } from './ui/panel';
import { buildParamsOf, completeState, defaultState } from './state/schema';
import type { AppState } from './state/schema';
import { encodeStateToken, decodeStateToken, tokenFromHash } from './state/share';
import { PRESETS, presetById } from './state/presets';
import type { SculptPreset } from './state/userPresets';
import { savePresetAs, userPresetsRecord } from './state/userPresets';
import type { Key } from './i18n';
import { autoPresetPrefixes, t, tDynamic, tr } from './i18n';

const PREVIEW_N = 96;
const HISTORY_LIMIT = 100;

const presetSel = el('presetSel', HTMLSelectElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const shareBtn = el('shareBtn', HTMLButtonElement);
const undoBtn = el('undoBtn', HTMLButtonElement);
const redoBtn = el('redoBtn', HTMLButtonElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const status = el('status', HTMLParagraphElement);
const warnings = el('warnings', HTMLParagraphElement);
const canvas = el('view', HTMLCanvasElement);
const graphCanvas = el('profileGraph', HTMLCanvasElement);
const progressWrap = el('progressWrap', HTMLDivElement);
const progressFill = el('progressFill', HTMLDivElement);
const progressLabel = el('progressLabel', HTMLSpanElement);

// --- состояние: share-ссылка или дефолты — начало истории, а не шаг ---
const token = tokenFromHash(location.hash);
const fromUrl = token ? decodeStateToken(token) : null;
const history = new History<AppState>(fromUrl ? completeState(fromUrl) : defaultState(), HISTORY_LIMIT);
/** параметры сборки показанного состояния (стенка уже в единицах модели) */
let params: BuildParams = buildParamsOf(history.state);
/** открытый пресет (`b:<id>`, `u:<id>`) или никакой */
let presetRef: PresetRef = '';
/** JSON показанного состояния: законченная правка того же, что уже показано кадрами, не пересобирает */
let shown = '';

/** Правка: кадр жеста (`live`) или законченная — шаг отмены (`commit`). */
function edit(next: AppState, final: boolean): void {
  if (final) history.commit(next);
  else history.live(next);
  show();
}

/** Показывает состояние истории: панель, превью и полную сборку, кнопки отмены. */
function show(): void {
  const state = history.state;
  panel.sync(state);
  syncHistoryButtons();
  const json = JSON.stringify(state);
  if (json === shown) return;
  shown = json;
  params = buildParamsOf(state);
  rebuildPreview();
  scheduleFullBuild();
}

// --- детализация полной сборки: не модель, в историю и пресеты не идёт ---
interface BuildSettings {
  resolution: string;
}
let buildSettings: BuildSettings = { resolution: '256' };
const RESOLUTION_ROWS: readonly Control<BuildSettings, Key>[] = [
  {
    kind: 'select',
    key: 'resolution',
    label: 'shape.resolution',
    options: ['192', '256', '384', '512'].map((value) => ({ value, text: `${value} × ${value}` })),
    get: (settings) => settings.resolution,
    set: (settings, resolution) => ({ ...settings, resolution }),
  },
];
renderControls(el('exportControls', HTMLDivElement), RESOLUTION_ROWS, {
  read: () => buildSettings,
  change: (next) => {
    buildSettings = next;
    scheduleFullBuild();
  },
  idPrefix: 'export',
  t: tr,
});

function fullResolution(): number {
  return Number.parseInt(buildSettings.resolution, 10) || 256;
}

// --- панель ---
const panel = renderPanel(
  {
    shape: el('shapeControls', HTMLDivElement),
    carriers: el('carrierCards', HTMLDivElement),
    displace: el('displaceCards', HTMLDivElement),
    deform: el('deformCards', HTMLDivElement),
    mod: el('modCard', HTMLDivElement),
  },
  { read: () => history.state, change: edit, t: tr },
);

// --- пресеты: встроенные по id (`core/presets` кита), свои — запись кита ---
const storage = browserStorage();
let userPresets: SculptPreset[] = loadRecord(storage, userPresetsRecord) ?? [];

function builtinName(id: string): string {
  return tDynamic(`preset.${id}.name`);
}

/** Имя открытого пресета: встроенного — из словаря, своего — данное. */
function currentName(): string {
  const id = presetRef.slice(2);
  if (presetRef.startsWith('b:')) return builtinName(id);
  if (presetRef.startsWith('u:')) return userPresets.find((preset) => preset.id === id)?.name ?? '';
  return '';
}

function refreshPresetList(): void {
  presetSel.innerHTML = '';
  const custom = document.createElement('option');
  custom.value = '';
  const name = currentName();
  custom.textContent = name ? `● ${name}` : '— preset —';
  presetSel.appendChild(custom);
  const builtins = document.createElement('optgroup');
  builtins.label = t('kit.preset.builtIn');
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = makePresetRef('b', p.id);
    opt.textContent = builtinName(p.id);
    builtins.appendChild(opt);
  }
  presetSel.appendChild(builtins);
  if (userPresets.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = t('kit.preset.mine');
    for (const p of userPresets) {
      const opt = document.createElement('option');
      opt.value = makePresetRef('u', p.id);
      opt.textContent = p.name;
      grp.appendChild(opt);
    }
    presetSel.appendChild(grp);
  }
  presetSel.value = '';
}

// открыть пресет — один шаг отмены
presetSel.addEventListener('change', () => {
  const ref = presetSel.value;
  if (!isPresetRef(ref)) return;
  const id = ref.slice(2);
  const state = ref.startsWith('b:') ? presetById(id)?.build() : userPresets.find((preset) => preset.id === id)?.state;
  if (!state) return;
  presetRef = ref;
  edit(state, true);
  refreshPresetList();
});

saveBtn.addEventListener('click', () => {
  const name = window.prompt(t('presets.prompt'), currentName() || nextPresetName(userPresets, autoPresetPrefixes(), t('presets.auto')));
  if (!name) return;
  const saved = savePresetAs(userPresets, name, history.state);
  userPresets = saved.list;
  presetRef = makePresetRef('u', saved.id);
  // пресет остаётся в списке до перезагрузки, даже если браузер его не сохранил
  const written = saveRecord(storage, userPresetsRecord, userPresets);
  refreshPresetList();
  if (written !== 'ok') warnings.textContent = t(written === 'full' ? 'kit.storage.preset.saveFull' : 'kit.storage.preset.save');
});

shareBtn.addEventListener('click', () => {
  const token = encodeStateToken(history.state);
  const url = `${location.origin}${location.pathname}#s=${token}`;
  window.history.replaceState(null, '', `#s=${token}`);
  navigator.clipboard?.writeText(url).then(
    () => flash(shareBtn, 'Copied!'),
    () => flash(shareBtn, 'Link in URL'),
  );
});

function flash(btn: HTMLButtonElement, text: string): void {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = old;
  }, 1200);
}

// --- отмена: история кита; шаг — законченная правка ---
function syncHistoryButtons(): void {
  undoBtn.disabled = !history.canUndo;
  redoBtn.disabled = !history.canRedo;
}

function undo(): void {
  if (history.undo()) show();
}

function redo(): void {
  if (history.redo()) show();
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && event.shiftKey) {
    event.preventDefault();
    redo();
  } else if (key === 'z') {
    event.preventDefault();
    undo();
  } else if (key === 'y') {
    event.preventDefault();
    redo();
  }
});

// --- сборка: превью в главном потоке + полная сетка в worker ---
const scene = createScene(canvas);
let worker: Worker | null = null;
let fullTimer: ReturnType<typeof setTimeout> | null = null;
let lastFullMesh: SurfaceMesh | null = null;
let fullDirty = true;

function setProgress(visible: boolean, t = 0, phase = ''): void {
  progressWrap.hidden = !visible;
  if (visible) {
    progressFill.style.width = `${Math.round(Math.min(1, Math.max(0, t)) * 100)}%`;
    progressLabel.textContent = phase;
  } else {
    progressFill.style.width = '0%';
    progressLabel.textContent = '';
  }
}

function killWorker(): void {
  worker?.terminate();
  worker = null;
}

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === 'object' && u !== null;
}

function showReport(report: MeshReport, overhang: number, buildMs: number, full: boolean): void {
  const kTris = (report.triangleCount / 1000).toFixed(1);
  // полый сосуд (open top + стенка) — это уже watertight-солид, а не оболочка
  const hollow = params.caps === 'bottom' && params.wall > 0;
  const shouldClose = params.caps === 'both' || hollow;
  const closed = shouldClose ? (report.watertight ? 'watertight ✓' : 'NOT watertight ✗') : 'open top (zero-wall shell)';
  const tag = full ? `full ${buildSettings.resolution}×${buildSettings.resolution}` : 'preview';
  status.textContent = `${kTris}k triangles · ${closed} · ${tag} · ${buildMs.toFixed(0)} ms`;
  const out: string[] = [];
  if (!report.finite) out.push('⚠ Non-finite vertices — check parameters');
  if (!report.indicesValid) out.push('⚠ Invalid triangle indices');
  if (shouldClose && !report.watertight) out.push('⚠ Mesh is not watertight');
  if (shouldClose && report.volume < 0) out.push('⚠ Mesh is oriented inside-out');
  if (report.degenerateTriangles > 0) {
    out.push(`⚠ Degenerate triangles: ${report.degenerateTriangles}`);
  }
  if (overhang > 0.02) {
    out.push(`⚠ Overhangs steeper than 60°: ${(overhang * 100).toFixed(0)}% of surface (hard to FDM-print)`);
  }
  const prof = radiusFnFor(params);
  if (prof) {
    let ampBudget = 0;
    for (const card of Object.values(params.displace)) {
      if (card.on) ampBudget += Math.abs(card.params.amp ?? 0);
    }
    let minR = Infinity;
    for (let i = 0; i <= 100; i++) minR = Math.min(minR, prof.radiusFn(i / 100));
    if (ampBudget > minR) out.push('⚠ Displacement amplitude exceeds local radius — possible self-intersections');
  }
  warnings.textContent = out.join('\n');
}

function startFullBuild(): void {
  killWorker();
  const w = new Worker(new URL('./worker/build.ts', import.meta.url), { type: 'module' });
  worker = w;
  const full: BuildParams = { ...params, nu: fullResolution(), nv: fullResolution() };
  w.addEventListener('message', (e: MessageEvent) => {
    const msg: unknown = e.data;
    if (!isRecord(msg)) return;
    if (msg.type === 'progress' && typeof msg.t === 'number') {
      setProgress(true, msg.t, typeof msg.phase === 'string' ? msg.phase : '');
    } else if (msg.type === 'done') {
      const { positions, normals, indices, report, overhang, buildMs } = msg;
      if (
        positions instanceof Float32Array &&
        normals instanceof Float32Array &&
        indices instanceof Uint32Array &&
        isRecord(report) &&
        typeof overhang === 'number' &&
        typeof buildMs === 'number'
      ) {
        const mesh: SurfaceMesh = { positions, normals, indices };
        lastFullMesh = mesh;
        fullDirty = false;
        scene.setMesh(mesh);
        // report пришёл структурным клоном из validateMesh — форма совпадает
        const r: unknown = report;
        if (isMeshReport(r)) showReport(r, overhang, buildMs, true);
      }
      setProgress(false);
      killWorker();
    }
  });
  w.postMessage(full);
  setProgress(true, 0.02, 'starting');
}

function isMeshReport(u: unknown): u is MeshReport {
  return isRecord(u) && typeof u.watertight === 'boolean' && typeof u.triangleCount === 'number';
}

function scheduleFullBuild(): void {
  fullDirty = true;
  // параметры изменились: результат летящего воркера уже неактуален —
  // убиваем сразу, иначе его done затрёт свежее превью старым мешем
  killWorker();
  setProgress(false);
  if (fullTimer) clearTimeout(fullTimer);
  fullTimer = setTimeout(() => {
    fullTimer = null;
    startFullBuild();
  }, 400);
}

/** Мгновенное превью: низкое разрешение в главном потоке. */
function rebuildPreview(): void {
  const t0 = performance.now();
  const preview: BuildParams = { ...params, nu: PREVIEW_N, nv: PREVIEW_N };
  const mesh = buildMesh(preview);
  scene.setMesh(mesh);
  const report = validateMesh(mesh);
  showReport(report, overhangFraction(mesh), performance.now() - t0, false);
  const prof = radiusFnFor(params);
  graphCanvas.hidden = !prof;
  if (prof) drawProfileGraph(graphCanvas, prof.radiusFn, prof.height);
}

// --- экспорт ---
exportBtn.addEventListener('click', () => {
  const mesh = fullDirty || !lastFullMesh ? buildMesh({ ...params, nu: fullResolution(), nv: fullResolution() }) : lastFullMesh;
  const report = validateMesh(mesh);
  const shouldBeClosed = params.caps === 'both' || (params.caps === 'bottom' && params.wall > 0);
  const assessment = assessExport(report, shouldBeClosed);
  if (assessment.blocking.length > 0) {
    warnings.textContent = `Export blocked:\n${assessment.blocking.map((issue) => `• ${issue}`).join('\n')}`;
    return;
  }
  if (assessment.warnings.length > 0 && !window.confirm(`The mesh has warnings:\n\n${assessment.warnings.join('\n')}\n\nExport anyway?`))
    return;
  const zExtent = report.bbox.max[2] - report.bbox.min[2];
  const targetMm = history.state.heightMm;
  const name = currentName() || params.profile;
  const buf = encodeSTL(mesh, { scale: targetMm / zExtent, name });
  const blob = new Blob([buf], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.stl`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- старт ---
refreshPresetList();
show();
