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
import { encodeSTL, stlFileName } from 'maker-kit/3d/stl';
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
import { moduleWorker, WorkerClient } from 'maker-kit/worker/client';
import type { BuildParams } from './geo/build';
import { buildMesh, radiusFnFor } from './geo/build';
import { overhangFraction } from './geo/overhang';
import { toMillimetres } from './geo/millimetres';
import { createScene } from './render/scene';
import { drawProfileGraph } from './ui/graph';
import { renderPanel } from './ui/panel';
import type { PanelHandle } from './ui/panel';
import type { Verdict } from './ui/report';
import { meshVerdicts, statusText } from './ui/report';
import { applyStaticText } from './ui/staticText';
import { buildParamsOf, defaultState } from './state/schema';
import type { AppState } from './state/schema';
import { BLANK_ID, PRESETS, presetById } from './state/presets';
import type { SculptPreset } from './state/userPresets';
import { savePresetAs, userPresetsRecord } from './state/userPresets';
import type { BuildJob, BuildResult } from './worker/protocol';
import type { Key } from './i18n';
import { LANGS, autoPresetPrefixes, hasKey, initLang, lang, onLangChange, setLang, t, tDynamic, tm, tr } from './i18n';

const PREVIEW_N = 96;
const HISTORY_LIMIT = 100;

const presetBtn = el('presetBtn', HTMLButtonElement);
const newBtn = el('newBtn', HTMLButtonElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const undoBtn = el('undoBtn', HTMLButtonElement);
const redoBtn = el('redoBtn', HTMLButtonElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const status = el('status', HTMLParagraphElement);
const messages = el('messages', HTMLUListElement);
const storageNote = el('storageNote', HTMLDivElement);
const canvas = el('view', HTMLCanvasElement);
const graphCanvas = el('profileGraph', HTMLCanvasElement);
/** 3D-вид кита; null без WebGL — приложение работает и без него */
const scene = createScene(canvas);

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
  // вид ставит модель над поднятым листом
  onInset: (px) => scene?.setInset(px),
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

// 📄 Новое — пустой пресет кита: модель по умолчанию под именем «New model», один шаг отмены
newBtn.addEventListener('click', () => {
  const blank = presetById(BLANK_ID);
  if (!blank) return;
  presetRef = makePresetRef('b', BLANK_ID);
  edit(blank.build(), true);
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

// --- сборка: превью в главном потоке + полная сетка в воркере (очередь кита) ---
const progress = createProgress(el('progressWrap', HTMLDivElement), { t: tr });
// Vite находит и собирает воркер только по `new Worker(new URL(…))` в коде приложения
const client = new WorkerClient<BuildJob, BuildResult>(
  moduleWorker(() => new Worker(new URL('./worker/build.worker.ts', import.meta.url), { type: 'module' })),
  // одна дорожка: ждущая полная сборка вытесняется свежей, выгрузка (kept) — нет
  { lane: () => 'model', kept: (job) => job.kind === 'export' },
);
let fullTimer: ReturnType<typeof setTimeout> | null = null;
/** номер последней заказанной полной сборки: результат прежней устарел */
let fullSerial = 0;
/** полная сборка показанного состояния, когда она готова */
let lastFull: BuildResult | null = null;

/** Ход работы воркера — на полосу: этапы, что есть в словаре (`stage.<phase>`), с подписью. */
function stage(p: JobProgress): JobProgress<Key> {
  const code = p.label?.code;
  return code !== undefined && hasKey(code) ? { step: p.step, total: p.total, label: { code } } : { step: p.step, total: p.total };
}

function messageLines(verdicts: readonly Verdict[]): { severity: Verdict['severity']; text: string; code: string }[] {
  return verdicts.map((verdict) => ({ severity: verdict.severity, text: tm(verdict.message), code: verdict.message.code }));
}

/** что показано в статусе и списке — чтобы перевести его при смене языка, не пересобирая */
let lastReport: Parameters<typeof showReport> | null = null;

function showReport(report: MeshReport, overhang: number, buildMs: number, resolution: number | null): void {
  lastReport = [report, overhang, buildMs, resolution];
  status.textContent = statusText(report, params, { resolution, ms: buildMs }, tr);
  // для скриптов: какая сборка показана, на любом языке
  status.dataset.build = resolution === null ? 'preview' : 'full';
  renderMessages(messages, messageLines(meshVerdicts(report, params, overhang)));
}

/** Сбой воркера — строкой в списке сообщений. */
function failed(key: 'build.failed' | 'export.failed', error: unknown): void {
  renderMessages(messages, [
    { severity: 'bad', text: t(key, { error: error instanceof Error ? error.message : String(error) }), code: key },
  ]);
}

function startFullBuild(): void {
  const serial = ++fullSerial;
  const resolution = fullResolution();
  const job: BuildJob = { kind: 'full', state: history.state, resolution };
  void progress
    .track((onProgress) => client.run(job, (p) => onProgress(stage(p))))
    .then(
      (done) => {
        // null: свежая задача вытеснила ждущую; другой номер — модель с тех пор изменилась
        if (!done || serial !== fullSerial) return;
        lastFull = done.result;
        scene?.show(done.result.mesh);
        showReport(done.result.report, done.result.overhang, done.ms, resolution);
      },
      (error: unknown) => failed('build.failed', error),
    );
}

function scheduleFullBuild(): void {
  // модель или детализация изменились: готовая полная сборка устарела, идущая —
  // тоже. Идущую воркер доделает (кит не обрывает задачу), её результат отбросится.
  lastFull = null;
  fullSerial++;
  if (fullTimer) clearTimeout(fullTimer);
  fullTimer = setTimeout(() => {
    fullTimer = null;
    startFullBuild();
  }, 400);
}

/** Мгновенное превью: низкое разрешение в главном потоке, в миллиметрах. */
function rebuildPreview(): void {
  const t0 = performance.now();
  const preview: BuildParams = { ...params, nu: PREVIEW_N, nv: PREVIEW_N };
  const mesh = toMillimetres(buildMesh(preview), history.state.heightMm);
  scene?.show(mesh);
  showReport(validateMesh(mesh), overhangFraction(mesh), performance.now() - t0, null);
  const prof = radiusFnFor(params);
  graphCanvas.hidden = !prof;
  if (prof) drawProfileGraph(graphCanvas, prof.radiusFn, prof.height);
}

// --- экспорт: готовая полная сборка или задача выгрузки в воркере; сито кита ---
async function exportStl(): Promise<void> {
  const state = history.state;
  const resolution = fullResolution();
  const result =
    lastFull ??
    (
      await progress.track((onProgress) => client.run({ kind: 'export', state, resolution }, (p) => onProgress(stage(p))), {
        label: 'export.progress',
        delayMs: 0,
      })
    )?.result;
  if (!result) return;
  const verdicts = meshVerdicts(result.report, buildParamsOf(state), result.overhang);
  if (verdicts.some((verdict) => verdict.severity === 'bad')) {
    renderMessages(messages, [{ severity: 'bad', text: t('export.blocked'), code: 'export.blocked' }, ...messageLines(verdicts)]);
    return;
  }
  const name = currentName() || state.profile;
  // меш уже в миллиметрах; имя файла сохраняет буквы любого письма: «Классическая ваза» → классическая-ваза.stl
  download(stlFileName(name, 'mathsculpt'), encodeSTL(result.mesh, { brand: 'MathSculpt', name }), 'model/stl');
}

exportBtn.addEventListener('click', () => {
  exportStl().catch((error: unknown) => failed('export.failed', error));
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
