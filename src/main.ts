// Точка входа: состояние → ядро геометрии → вид и панель.
//
// Раскладка и рамка — китовые: шапка (имя проекта открывает диалог
// пресетов, 💾, ↶ ↷), панель сбоку от вида или нижним листом на телефоне,
// полоса прогресса поверх вида, баннер сбоя хранилища, список сообщений в
// карточке экспорта. Состояние одно и неизменяемое — то, что держит история
// кита: правка панели — новое состояние, `final` делает её шагом отмены.
//
// Превью 96×96 строится в главном потоке мгновенно; полная сетка — в
// Web Worker (паттерн mandelbulb-worker).
import 'maker-kit/styles/kit.css';
import './style.css';
import type { MeshReport } from 'maker-kit/3d/validate';
import { validateMesh } from 'maker-kit/3d/validate';
import { stlFileName } from 'maker-kit/3d/stl';
import { History } from 'maker-kit/core/history';
import type { JobProgress } from 'maker-kit/core/progress';
import type { PresetRef } from 'maker-kit/core/presets';
import { nextPresetName, presetRef as makePresetRef, presetStatus, removeUserPreset, renameUserPreset } from 'maker-kit/core/presets';
import type { StorageWrite } from 'maker-kit/core/storage';
import { browserStorage, loadRecord, saveRecord } from 'maker-kit/core/storage';
import type { StorageStatus } from 'maker-kit/ui/banner';
import { renderBanner } from 'maker-kit/ui/banner';
import { restoreCards, snapshotCards } from 'maker-kit/ui/card';
import type { Control } from 'maker-kit/ui/controls';
import { renderControls } from 'maker-kit/ui/controls';
import { el } from 'maker-kit/ui/dom';
import { download } from 'maker-kit/ui/files';
import { bindHistory } from 'maker-kit/ui/historyKeys';
import { createLanguagePicker } from 'maker-kit/ui/languagePicker';
import { renderMessages } from 'maker-kit/ui/messageList';
import { createModal } from 'maker-kit/ui/modal';
import { renderPresetList } from 'maker-kit/ui/presetList';
import { createProgress } from 'maker-kit/ui/progress';
import { setupSheet } from 'maker-kit/ui/sheet';
import type { BuildParams } from './geo/build';
import { buildMesh, radiusFnFor } from './geo/build';
import { overhangFraction } from './geo/overhang';
import type { SurfaceMesh } from './geo/surface';
import { encodeSTL } from './geo/stl';
import { createScene } from './render/scene';
import { drawProfileGraph } from './ui/graph';
import { renderPanel } from './ui/panel';
import type { PanelHandle } from './ui/panel';
import type { Verdict } from './ui/report';
import { meshVerdicts, statusText } from './ui/report';
import { applyStaticText } from './ui/staticText';
import { buildParamsOf, defaultState } from './state/schema';
import type { AppState } from './state/schema';
import { PRESETS, presetById } from './state/presets';
import type { SculptPreset } from './state/userPresets';
import { savePresetAs, userPresetsRecord } from './state/userPresets';
import type { Key } from './i18n';
import { LANGS, autoPresetPrefixes, hasKey, initLang, lang, onLangChange, setLang, t, tDynamic, tm, tr } from './i18n';

const PREVIEW_N = 96;
const HISTORY_LIMIT = 100;

const presetBtn = el('presetBtn', HTMLButtonElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const undoBtn = el('undoBtn', HTMLButtonElement);
const redoBtn = el('redoBtn', HTMLButtonElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const status = el('status', HTMLParagraphElement);
const messages = el('messages', HTMLUListElement);
const storageNote = el('storageNote', HTMLDivElement);
const canvas = el('view', HTMLCanvasElement);
const graphCanvas = el('profileGraph', HTMLCanvasElement);

// язык: сохранённый выбор → языки браузера → английский
initLang();
applyStaticText(document);

// --- состояние: начало истории, а не шаг ---
const history = new History<AppState>(defaultState(), HISTORY_LIMIT);
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

/** Показывает состояние истории: панель, превью и полную сборку, кнопки отмены, ● на имени. */
function show(): void {
  const state = history.state;
  panel.sync(state);
  historyKeys.refresh();
  refreshPresetButton();
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
const exportControls = el('exportControls', HTMLDivElement);
function drawResolution(): void {
  renderControls(exportControls, RESOLUTION_ROWS, {
    read: () => buildSettings,
    change: (next) => {
      buildSettings = next;
      scheduleFullBuild();
    },
    idPrefix: 'export',
    t: tr,
  });
}
drawResolution();

function fullResolution(): number {
  return Number.parseInt(buildSettings.resolution, 10) || 256;
}

// --- панель: лист на телефоне; после смены языка рисуется заново ---
const panelHosts = {
  shape: el('shapeControls', HTMLDivElement),
  carriers: el('carrierCards', HTMLDivElement),
  displace: el('displaceCards', HTMLDivElement),
  deform: el('deformCards', HTMLDivElement),
  mod: el('modCard', HTMLDivElement),
};
const panelEl = el('panel', HTMLElement);
const drawPanel = (): PanelHandle => renderPanel(panelHosts, { read: () => history.state, change: edit, t: tr });
let panel = drawPanel();
setupSheet({
  panel: panelEl,
  button: el('sheetOpen', HTMLButtonElement),
  close: el('sheetClose', HTMLButtonElement),
  view: el('viewWrap', HTMLElement),
  narrow: matchMedia('(max-width: 1023px)'),
});

// --- отмена: ↶ ↷ и Ctrl/⌘+Z на любой раскладке (китовые) ---
const historyKeys = bindHistory({
  undo: undoBtn,
  redo: redoBtn,
  onUndo: () => {
    if (history.undo()) show();
  },
  onRedo: () => {
    if (history.redo()) show();
  },
  canUndo: () => history.canUndo,
  canRedo: () => history.canRedo,
});

// --- что не сохранил браузер: баннер кита ---
let storageStatus: StorageStatus = { project: 'ok', preset: null };

function drawBanner(): void {
  renderBanner(storageNote, storageStatus, {
    t: tr,
    // у MathSculpt пока нет файла проекта: строка о модели не показывается (project всегда ok)
    advice: { blocked: 'kit.storage.advice.file', full: 'kit.storage.advice.fileFull' },
    onDismiss: () => {
      storageStatus = { ...storageStatus, preset: null };
      drawBanner();
    },
  });
}

/** Пишет свои пресеты; сбой — в баннер, удача снимает прошлый сбой. */
function writePresets(action: 'save' | 'delete'): void {
  const result: StorageWrite = saveRecord(storage, userPresetsRecord, userPresets);
  storageStatus = { ...storageStatus, preset: result === 'ok' ? null : { action, result } };
  drawBanner();
}

// --- пресеты: встроенные по id (`core/presets` кита), свои — запись кита, диалог кита ---
const storage = browserStorage();
let userPresets: SculptPreset[] = loadRecord(storage, userPresetsRecord) ?? [];
const presetsDialog = createModal(el('presets', HTMLDivElement), { close: el('presetsClose', HTMLButtonElement) });
const presetList = el('presetList', HTMLDivElement);

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

function presetState(ref: PresetRef): AppState | undefined {
  const id = ref.slice(2);
  return ref.startsWith('b:') ? presetById(id)?.build() : userPresets.find((preset) => preset.id === id)?.state;
}

/** Модель ушла от открытого пресета? Состояние — вся модель, поэтому подпись — оно целиком. */
function currentStatus(): ReturnType<typeof presetStatus> {
  return presetStatus(presetRef, history.state, presetState, (state) => JSON.stringify(state));
}

function refreshPresetButton(): void {
  presetBtn.textContent = currentName() || t('kit.topbar.presets');
  presetBtn.classList.toggle('changed', currentStatus() === 'changed');
  if (presetsDialog.isOpen()) drawPresetList();
}

function drawPresetList(): void {
  renderPresetList(presetList, {
    builtIn: PRESETS.filter((preset) => preset.listed !== false).map((preset) => ({ id: preset.id, label: builtinName(preset.id) })),
    user: userPresets.map(({ id, name }) => ({ id, name })),
    current: presetRef,
    status: currentStatus(),
    t: tr,
    open: (ref) => {
      const state = presetState(ref);
      if (!state) return;
      presetRef = ref;
      presetsDialog.close();
      // открыть пресет — один шаг отмены
      edit(state, true);
    },
    rename: (id, name) => {
      userPresets = renameUserPreset(userPresets, id, name);
      writePresets('save');
      refreshPresetButton();
    },
    remove: (id) => {
      userPresets = removeUserPreset(userPresets, id);
      if (presetRef === `u:${id}`) presetRef = '';
      writePresets('delete');
      refreshPresetButton();
    },
  });
}

presetBtn.addEventListener('click', () => {
  drawPresetList();
  presetsDialog.open(presetBtn);
});

saveBtn.addEventListener('click', () => {
  const name = window.prompt(t('presets.prompt'), currentName() || nextPresetName(userPresets, autoPresetPrefixes(), t('presets.auto')));
  if (!name) return;
  const saved = savePresetAs(userPresets, name, history.state);
  // пресет остаётся в списке до перезагрузки, даже если браузер его не сохранил
  userPresets = saved.list;
  presetRef = makePresetRef('u', saved.id);
  writePresets('save');
  refreshPresetButton();
});

// --- сборка: превью в главном потоке + полная сетка в worker ---
const scene = createScene(canvas);
const progress = createProgress(el('progressWrap', HTMLDivElement), { t: tr });
let worker: Worker | null = null;
/** снимает полосу прогресса с полной сборки, которую убили */
let cancelFull: (() => void) | null = null;
let fullTimer: ReturnType<typeof setTimeout> | null = null;
let lastFullMesh: SurfaceMesh | null = null;
let fullDirty = true;

function killWorker(): void {
  worker?.terminate();
  worker = null;
  cancelFull?.();
  cancelFull = null;
}

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === 'object' && u !== null;
}

function isMeshReport(u: unknown): u is MeshReport {
  return isRecord(u) && typeof u.watertight === 'boolean' && typeof u.triangleCount === 'number';
}

/** Доля и этап сборки — на полосу: этап — ключ словаря `stage.<phase>`. */
function stage(share: number, phase: string): JobProgress<Key> {
  const key = `stage.${phase}`;
  const done = { step: Math.round(Math.min(1, Math.max(0, share)) * 100), total: 100 };
  return hasKey(key) ? { ...done, label: { code: key } } : done;
}

function messageLines(verdicts: readonly Verdict[]): { severity: Verdict['severity']; text: string; code: string }[] {
  return verdicts.map((verdict) => ({ severity: verdict.severity, text: tm(verdict.message), code: verdict.message.code }));
}

/** что показано в статусе и списке — чтобы перевести его при смене языка, не пересобирая */
let lastReport: Parameters<typeof showReport> | null = null;

function showReport(report: MeshReport, overhang: number, buildMs: number, resolution: number | null): void {
  lastReport = [report, overhang, buildMs, resolution];
  status.textContent = statusText(report, params, { resolution, ms: buildMs }, tr);
  renderMessages(messages, messageLines(meshVerdicts(report, params, overhang)));
}

function startFullBuild(): void {
  killWorker();
  const w = new Worker(new URL('./worker/build.ts', import.meta.url), { type: 'module' });
  worker = w;
  const resolution = fullResolution();
  const full: BuildParams = { ...params, nu: resolution, nv: resolution };
  void progress.track(
    (onProgress) =>
      new Promise<void>((resolve) => {
        cancelFull = resolve;
        w.addEventListener('message', (e: MessageEvent) => {
          const msg: unknown = e.data;
          if (!isRecord(msg)) return;
          if (msg.type === 'progress' && typeof msg.t === 'number') {
            onProgress(stage(msg.t, typeof msg.phase === 'string' ? msg.phase : ''));
          } else if (msg.type === 'done') {
            const { positions, normals, indices, report, overhang, buildMs } = msg;
            if (
              positions instanceof Float32Array &&
              normals instanceof Float32Array &&
              indices instanceof Uint32Array &&
              isMeshReport(report) &&
              typeof overhang === 'number' &&
              typeof buildMs === 'number'
            ) {
              const mesh: SurfaceMesh = { positions, normals, indices };
              lastFullMesh = mesh;
              fullDirty = false;
              scene.setMesh(mesh);
              showReport(report, overhang, buildMs, resolution);
            }
            resolve();
            killWorker();
          }
        });
        w.postMessage(full);
      }),
  );
}

function scheduleFullBuild(): void {
  fullDirty = true;
  // параметры изменились: результат летящего воркера уже неактуален —
  // убиваем сразу, иначе его done затрёт свежее превью старым мешем
  killWorker();
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
  showReport(validateMesh(mesh), overhangFraction(mesh), performance.now() - t0, null);
  const prof = radiusFnFor(params);
  graphCanvas.hidden = !prof;
  if (prof) drawProfileGraph(graphCanvas, prof.radiusFn, prof.height);
}

// --- экспорт: сито кита; предупреждения уже в списке, вопроса нет ---
exportBtn.addEventListener('click', () => {
  const resolution = fullResolution();
  const mesh = fullDirty || !lastFullMesh ? buildMesh({ ...params, nu: resolution, nv: resolution }) : lastFullMesh;
  const report = validateMesh(mesh);
  const verdicts = meshVerdicts(report, params, overhangFraction(mesh));
  if (verdicts.some((verdict) => verdict.severity === 'bad')) {
    renderMessages(messages, [{ severity: 'bad', text: t('export.blocked'), code: 'export.blocked' }, ...messageLines(verdicts)]);
    return;
  }
  const zExtent = report.bbox.max[2] - report.bbox.min[2];
  const name = currentName() || params.profile;
  // имя файла сохраняет буквы любого письма: «Классическая ваза» → классическая-ваза.stl
  download(stlFileName(name, 'mathsculpt'), encodeSTL(mesh, { scale: history.state.heightMm / zExtent, name }), 'model/stl');
});

// --- язык: 🌐 в шапке; смена перерисовывает всё, где есть слова ---
const languagePicker = createLanguagePicker(el('topbar', HTMLElement), { locales: LANGS, current: lang(), t: tr, onChange: setLang });
onLangChange((next) => {
  languagePicker.set(next);
  applyStaticText(document);
  const folded = snapshotCards(panelEl);
  panel = drawPanel();
  restoreCards(panelEl, folded);
  drawResolution();
  progress.refresh();
  drawBanner();
  refreshPresetButton();
  if (lastReport) showReport(...lastReport);
});

// --- старт ---
show();
