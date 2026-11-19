// The entry point: state → geometry core → view and panel.
//
// The layout and the frame are the kit's: the top bar (the project's name
// opens the presets dialog, 💾, ↶ ↷), the panel beside the view or a bottom
// sheet on a phone, the progress bar over the view, the storage banner, the
// message list in the export card. The state is one and immutable — what
// the kit's history holds: an edit in the panel is a new state, and `final`
// makes it an undo step.
//
// The 96×96 preview is built on the main thread at once; the full grid in a
// Web Worker (the mandelbulb-worker pattern).
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
import { download, pickFile } from 'maker-kit/ui/files';
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
import { registerServiceWorker } from './pwa';
import { buildParamsOf, defaultState } from './state/schema';
import type { AppState } from './state/schema';
import { BLANK_ID, PRESETS, presetById } from './state/presets';
import { decodeProject, encodeProject, projectFile } from './state/projectFile';
import type { SculptPreset } from './state/userPresets';
import { savePresetAs, userPresetsRecord } from './state/userPresets';
import { projectRecord } from './state/project';
import type { BuildJob, BuildResult } from './worker/protocol';
import type { Key } from './i18n';
import type { Params } from './i18n';
import { LANGS, autoPresetPrefixes, hasKey, initLang, lang, onLangChange, setLang, t, tDynamic, tm, tr } from './i18n';

const PREVIEW_N = 96;
const HISTORY_LIMIT = 100;

const presetBtn = el('presetBtn', HTMLButtonElement);
const newBtn = el('newBtn', HTMLButtonElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const fileOpenBtn = el('fileOpenBtn', HTMLButtonElement);
const fileSaveBtn = el('fileSaveBtn', HTMLButtonElement);
const undoBtn = el('undoBtn', HTMLButtonElement);
const redoBtn = el('redoBtn', HTMLButtonElement);
const exportBtn = el('exportBtn', HTMLButtonElement);
const status = el('status', HTMLParagraphElement);
const messages = el('messages', HTMLUListElement);
const storageNote = el('storageNote', HTMLDivElement);
const canvas = el('view', HTMLCanvasElement);
const graphCanvas = el('profileGraph', HTMLCanvasElement);
/** the kit's 3D view; null without WebGL — the app works without it */
const scene = createScene(canvas);

// the language: the stored choice → the browser's languages → English
initLang();
applyStaticText(document);

// --- the state: the model from the browser or the default — the start of the history, not a step ---
const storage = browserStorage();
const opening = loadRecord(storage, projectRecord);
const history = new History<AppState>(opening?.state ?? defaultState(), HISTORY_LIMIT);
/** the build parameters of the shown state (the wall already in model units) */
let params: BuildParams = buildParamsOf(history.state);
/** the open preset (`b:<id>`, `u:<id>`) or none */
let presetRef: PresetRef = opening?.ref ?? '';
/** the name given to the project file (⬇️ or an opened 📂); empty — the open preset's name */
let givenName = opening?.name ?? '';
/** the shown state's JSON: a finished edit of what its frames already showed does not rebuild */
let shown = '';

/** An edit: a frame of a gesture (`live`) or a finished one — an undo step (`commit`). */
function edit(next: AppState, final: boolean): void {
  if (final) history.commit(next);
  else history.live(next);
  show();
  if (final) saveProject();
}

/** Shows the history's state: the panel, the preview and the full build, the undo buttons, ● on the name. */
function show(): void {
  const state = history.state;
  panel.sync(state);
  historyKeys.refresh();
  refreshPresetButton();
  const json = JSON.stringify(state);
  if (json === shown) return;
  shown = json;
  // the model changed: a line about a past event (a refused file, a failure) is no longer about it
  notice = null;
  params = buildParamsOf(state);
  rebuildPreview();
  scheduleFullBuild();
}

// --- the full build's resolution: not the model, so not in the history or presets ---
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

// --- the panel: a sheet on a phone; drawn again after a language switch ---
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
  // the view puts the model above the raised sheet
  onInset: (px) => scene?.setInset(px),
});

// --- undo: ↶ ↷ and Ctrl/⌘+Z on any keyboard layout (the kit's) ---
const historyKeys = bindHistory({
  undo: undoBtn,
  redo: redoBtn,
  onUndo: () => {
    if (!history.undo()) return;
    show();
    saveProject();
  },
  onRedo: () => {
    if (!history.redo()) return;
    show();
    saveProject();
  },
  canUndo: () => history.canUndo,
  canRedo: () => history.canRedo,
});

// --- what the browser failed to keep: the kit's banner ---
let storageStatus: StorageStatus = { project: 'ok', preset: null };

function drawBanner(): void {
  renderBanner(storageNote, storageStatus, {
    t: tr,
    // what to do when the browser keeps nothing: save the work to a file (⬇️), the kit's words
    advice: { blocked: 'kit.storage.advice.file', full: 'kit.storage.advice.fileFull' },
    onDismiss: () => {
      storageStatus = { ...storageStatus, preset: null };
      drawBanner();
    },
  });
}

/**
 * Writes the model to the browser (with the open preset and the given
 * name) after a finished edit, an undo, a change of preset or name. A
 * failure is the model's line in the banner while it lasts; the kit's
 * advice is to save to a file (⬇️).
 */
function saveProject(): void {
  storageStatus = {
    ...storageStatus,
    project: saveRecord(storage, projectRecord, { state: history.state, ref: presetRef, name: givenName }),
  };
  drawBanner();
}

/** Writes the user's presets; a failure goes to the banner, a success clears the last one. */
function writePresets(action: 'save' | 'delete'): void {
  const result: StorageWrite = saveRecord(storage, userPresetsRecord, userPresets);
  storageStatus = { ...storageStatus, preset: result === 'ok' ? null : { action, result } };
  drawBanner();
}

// --- presets: built-in by id (the kit's `core/presets`), the user's in the kit's record, the kit's dialog ---
let userPresets: SculptPreset[] = loadRecord(storage, userPresetsRecord) ?? [];
const presetsDialog = createModal(el('presets', HTMLDivElement), { close: el('presetsClose', HTMLButtonElement) });
const presetList = el('presetList', HTMLDivElement);

function builtinName(id: string): string {
  return tDynamic(`preset.${id}.name`);
}

/** The open preset's name: a built-in one's from the dictionary, a user one's as given. */
function currentName(): string {
  const id = presetRef.slice(2);
  if (presetRef.startsWith('b:')) return builtinName(id);
  if (presetRef.startsWith('u:')) return userPresets.find((preset) => preset.id === id)?.name ?? '';
  return '';
}

/** The project's name: the one given to its file, else the open preset's. */
function projectName(): string {
  return givenName || currentName();
}

function presetState(ref: PresetRef): AppState | undefined {
  const id = ref.slice(2);
  return ref.startsWith('b:') ? presetById(id)?.build() : userPresets.find((preset) => preset.id === id)?.state;
}

/** Has the model left the open preset? The state is the whole model, so the signature is all of it. */
function currentStatus(): ReturnType<typeof presetStatus> {
  return presetStatus(presetRef, history.state, presetState, (state) => JSON.stringify(state));
}

function refreshPresetButton(): void {
  presetBtn.textContent = projectName() || t('kit.topbar.presets');
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
      givenName = '';
      presetsDialog.close();
      // opening a preset is one undo step
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
      saveProject();
      refreshPresetButton();
    },
  });
}

presetBtn.addEventListener('click', () => {
  drawPresetList();
  presetsDialog.open(presetBtn);
});

// 📄 New — the kit's blank preset: the default model named "New model", one undo step
newBtn.addEventListener('click', () => {
  const blank = presetById(BLANK_ID);
  if (!blank) return;
  presetRef = makePresetRef('b', BLANK_ID);
  givenName = '';
  edit(blank.build(), true);
});

saveBtn.addEventListener('click', () => {
  const name = window.prompt(t('presets.prompt'), projectName() || nextPresetName(userPresets, autoPresetPrefixes(), t('presets.auto')));
  if (!name) return;
  const saved = savePresetAs(userPresets, name, history.state);
  // the preset stays in the list until a reload, even if the browser did not keep it
  userPresets = saved.list;
  presetRef = makePresetRef('u', saved.id);
  givenName = '';
  writePresets('save');
  saveProject();
  refreshPresetButton();
});

// --- the model as a file: ⬇️ save, 📂 open (the kit's `core/projectFile`) ---
const FILE_REFUSALS = { broken: 'kit.file.broken', foreign: 'kit.file.foreign', newer: 'kit.file.newer' } as const;

fileSaveBtn.addEventListener('click', () => {
  const name = window.prompt(t('file.prompt'), projectName());
  if (name === null) return;
  givenName = name.trim();
  download(projectFile(givenName), encodeProject(givenName, history.state), 'application/json');
  saveProject();
  refreshPresetButton();
});

fileOpenBtn.addEventListener('click', () => {
  void pickFile('.json,application/json').then(async (file) => {
    if (!file) return;
    const decoded = decodeProject(await file.text());
    if (!decoded.ok) {
      // a refusal in the kit's words: a foreign file never lays defaults over the work
      showNotice(FILE_REFUSALS[decoded.reason]);
      return;
    }
    presetRef = '';
    givenName = decoded.name;
    // opening a file is one undo step
    edit(decoded.state, true);
  });
});

// --- building: the preview on the main thread + the full grid in the worker (the kit's queue) ---
const progress = createProgress(el('progressWrap', HTMLDivElement), { t: tr });
// Vite finds and bundles a worker only by `new Worker(new URL(…))` in the app's own code
const client = new WorkerClient<BuildJob, BuildResult>(
  moduleWorker(() => new Worker(new URL('./worker/build.worker.ts', import.meta.url), { type: 'module' })),
  // one lane: a waiting full build is replaced by a fresher one, an export (kept) is not
  { lane: () => 'model', kept: (job) => job.kind === 'export' },
);
let fullTimer: ReturnType<typeof setTimeout> | null = null;
/** the number of the latest full build ordered: an earlier one's result is stale */
let fullSerial = 0;
/** the full build of the shown state, once it is ready */
let lastFull: BuildResult | null = null;

/** The worker's progress on the bar: the stages the dictionary has (`stage.<phase>`) with their label. */
function stage(p: JobProgress): JobProgress<Key> {
  const code = p.label?.code;
  return code !== undefined && hasKey(code) ? { step: p.step, total: p.total, label: { code } } : { step: p.step, total: p.total };
}

function messageLines(verdicts: readonly Verdict[]): { severity: Verdict['severity']; text: string; code: string }[] {
  return verdicts.map((verdict) => ({ severity: verdict.severity, text: tm(verdict.message), code: verdict.message.code }));
}

/** what the status and the list show — to translate it on a language switch without a rebuild */
let lastReport: Parameters<typeof showReport> | null = null;
/** the shown mesh's verdicts */
let verdicts: Verdict[] = [];
/**
 * A line about what just happened — a refused file, a worker failure, an
 * export blocked: first in the list until the model changes. Otherwise the
 * report of a full build finishing a second later would wipe it. Kept as a
 * key, to translate it again.
 */
let notice: { key: Key; params?: Params } | null = null;

function drawMessages(): void {
  const lines = messageLines(verdicts);
  renderMessages(messages, notice ? [{ severity: 'bad', text: t(notice.key, notice.params), code: notice.key }, ...lines] : lines);
}

function showNotice(key: Key, params?: Params): void {
  notice = { key, params };
  drawMessages();
}

function showReport(report: MeshReport, overhang: number, buildMs: number, resolution: number | null): void {
  lastReport = [report, overhang, buildMs, resolution];
  status.textContent = statusText(report, params, { resolution, ms: buildMs }, tr);
  // for the scripts: which build is shown, in any language
  status.dataset.build = resolution === null ? 'preview' : 'full';
  verdicts = meshVerdicts(report, params, overhang);
  drawMessages();
}

/** A worker failure, as a line on top of the message list. */
function failed(key: 'build.failed' | 'export.failed', error: unknown): void {
  showNotice(key, { error: error instanceof Error ? error.message : String(error) });
}

function startFullBuild(): void {
  const serial = ++fullSerial;
  const resolution = fullResolution();
  const job: BuildJob = { kind: 'full', state: history.state, resolution };
  void progress
    .track((onProgress) => client.run(job, (p) => onProgress(stage(p))))
    .then(
      (done) => {
        // null: a fresher job replaced the waiting one; another number: the model changed since
        if (!done || serial !== fullSerial) return;
        lastFull = done.result;
        scene?.show(done.result.mesh);
        showReport(done.result.report, done.result.overhang, done.ms, resolution);
      },
      (error: unknown) => failed('build.failed', error),
    );
}

function scheduleFullBuild(): void {
  // the model or the resolution changed: the finished full build is stale, and
  // so is a running one. The worker finishes it (the kit never interrupts a
  // job); its result is dropped.
  lastFull = null;
  fullSerial++;
  if (fullTimer) clearTimeout(fullTimer);
  fullTimer = setTimeout(() => {
    fullTimer = null;
    startFullBuild();
  }, 400);
}

/** The instant preview: a low resolution on the main thread, in millimetres. */
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

// --- export: the finished full build or an export job in the worker; the kit's gate ---
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
  const gate = meshVerdicts(result.report, buildParamsOf(state), result.overhang);
  if (gate.some((verdict) => verdict.severity === 'bad')) {
    verdicts = gate;
    showNotice('export.blocked');
    return;
  }
  const name = projectName() || state.profile;
  // the mesh is in millimetres already; the file name keeps letters of any script: "Классическая ваза" → классическая-ваза.stl
  download(stlFileName(name, 'mathsculpt'), encodeSTL(result.mesh, { brand: 'MathSculpt', name }), 'model/stl');
}

exportBtn.addEventListener('click', () => {
  exportStl().catch((error: unknown) => failed('export.failed', error));
});

// --- the language: 🌐 in the top bar; a switch redraws everything with words ---
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

// --- start; offline after a first visit in the build only (a Vite plugin writes sw.js) ---
show();
if (import.meta.env.PROD) registerServiceWorker(navigator, window, document);
