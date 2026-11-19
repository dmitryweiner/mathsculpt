// Сборка UI: топбар (пресеты, Save, Share, Export), карточки смещений и
// деформеров, Фурье-профиль, матрица модуляции, график r(z).
// Превью 96×96 строится в главном потоке мгновенно; полная сетка — в
// Web Worker с прогресс-баром (паттерн mandelbulb-worker).
import './style.css';
import type { BuildParams } from './geo/build';
import { buildMesh, defaultParams, radiusFnFor, isRevolveProfile } from './geo/build';
import type { SurfaceMesh } from './geo/surface';
import { PROFILES, isProfileId, FOURIER_PROFILE_ID } from './geo/profiles';
import { SHAPE_IDS, isShapeId } from './geo/shapes';
import { validateMesh, overhangFraction, assessExport } from './geo/validate';
import type { MeshReport } from './geo/validate';
import { encodeSTL } from './geo/stl';
import { createScene } from './render/scene';
import { DISPLACE_CARDS, DEFORM_CARDS, FOURIER_CARD, PROFILE_SHAPE_CARD, SHAPE_CARDS } from './formulas';
import type { CardHandles } from './ui/cards';
import { buildCard } from './ui/cards';
import { setupAdjustmentButtons } from './ui/adjust';
import { el } from './ui/dom';
import { drawProfileGraph } from './ui/graph';
import { buildModPanel, updateModBadges } from './ui/modmatrix';
import { History } from 'maker-kit/core/history';
import type { PresetRef } from 'maker-kit/core/presets';
import { isPresetRef, nextPresetName, presetRef as makePresetRef } from 'maker-kit/core/presets';
import { browserStorage, loadRecord, saveRecord } from 'maker-kit/core/storage';
import { DEFAULT_HEIGHT_MM, DEFAULT_WALL_MM, completeState, defaultState, paramsToState, stateToParams } from './state/schema';
import type { AppState } from './state/schema';
import { encodeStateToken, decodeStateToken, tokenFromHash } from './state/share';
import { PRESETS, presetById } from './state/presets';
import type { SculptPreset } from './state/userPresets';
import { savePresetAs, userPresetsRecord } from './state/userPresets';
import { autoPresetPrefixes, t, tDynamic } from './i18n';

const PREVIEW_N = 96;

const profileSel = el('profile', HTMLSelectElement);
const capsSel = el('caps', HTMLSelectElement);
const resolutionSel = el('resolution', HTMLSelectElement);
const presetSel = el('presetSel', HTMLSelectElement);
const heightMmInput = el('heightMm', HTMLInputElement);
const wallRow = el('wallRow', HTMLLabelElement);
const wallInput = el('wallMm', HTMLInputElement);
const wallVal = el('wallVal', HTMLOutputElement);
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

// --- состояние ---
let params: BuildParams = defaultParams();
/** открытый пресет (`b:<id>`, `u:<id>`) или никакой */
let presetRef: PresetRef = '';
// толщина стенки задаётся в мм (UI), в build уходит относительной величиной
let wallMm = DEFAULT_WALL_MM;

// --- шапка: профиль ---
for (const p of PROFILES) {
  const opt = document.createElement('option');
  opt.value = p.id;
  opt.textContent = p.label;
  profileSel.appendChild(opt);
}
{
  const opt = document.createElement('option');
  opt.value = FOURIER_PROFILE_ID;
  opt.textContent = 'Fourier (formula)';
  profileSel.appendChild(opt);
}
const SHAPE_LABELS: Record<string, string> = {
  sphere: 'Sphere',
  torus: 'Torus',
  superellipsoid: 'Superellipsoid',
  supershape: 'Supershape',
};
for (const id of SHAPE_IDS) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = SHAPE_LABELS[id];
  profileSel.appendChild(opt);
}

// --- карточки ---
const cardHandles: CardHandles[] = [];
const displaceWrap = el('displaceCards', HTMLDivElement);
const deformWrap = el('deformCards', HTMLDivElement);
const fourierWrap = el('fourierWrap', HTMLDivElement);
const modWrap = el('modWrap', HTMLDivElement);
setupAdjustmentButtons(el('panel', HTMLElement));

/** Пересоздаёт привязку карточек и панели модуляции к текущему params. */
function rebuildCards(): void {
  cardHandles.length = 0;
  displaceWrap.innerHTML = '';
  for (const def of DISPLACE_CARDS) {
    const h = buildCard(def, params.displace[def.id], onParamChange);
    cardHandles.push(h);
    displaceWrap.appendChild(h.root);
  }
  deformWrap.innerHTML = '';
  for (const def of DEFORM_CARDS) {
    const h = buildCard(def, params.deform[def.id], onParamChange);
    cardHandles.push(h);
    deformWrap.appendChild(h.root);
  }
  fourierWrap.innerHTML = '';
  const psh = buildCard(PROFILE_SHAPE_CARD, { on: true, params: params.profileShape }, onParamChange, { alwaysOn: true });
  cardHandles.push(psh);
  fourierWrap.appendChild(psh.root);
  const fh = buildCard(FOURIER_CARD, { on: true, params: params.fourier }, onParamChange, { alwaysOn: true });
  cardHandles.push(fh);
  fourierWrap.appendChild(fh.root);
  for (const def of SHAPE_CARDS) {
    const sh = buildCard(def, { on: true, params: params.shapes[def.id] }, onParamChange, { alwaysOn: true });
    cardHandles.push(sh);
    fourierWrap.appendChild(sh.root);
  }
  modWrap.innerHTML = '';
  modWrap.appendChild(buildModPanel(params.mod, onParamChange).root);
  syncShapeCardVisibility();
  updateModBadges(params.mod);
}

/** Видимость карточек носителя: показывается только карточка выбранного. */
function syncShapeCardVisibility(): void {
  fourierWrap.hidden = false;
  const profileShapeCard = document.getElementById('card_profileShape');
  // настройка формы — для пресет-профилей (ваза/амфора/…), не для Фурье/фигур
  if (profileShapeCard) profileShapeCard.hidden = !isProfileId(params.profile);
  const fourierCard = document.getElementById('card_fourier');
  if (fourierCard) fourierCard.hidden = params.profile !== FOURIER_PROFILE_ID;
  for (const def of SHAPE_CARDS) {
    const cardEl = document.getElementById(`card_${def.id}`);
    if (cardEl) cardEl.hidden = params.profile !== def.id;
  }
}

// --- сворачиваемая секция Modulation ---
const modToggle = el('modToggle', HTMLHeadingElement);
const modCaret = el('modCaret', HTMLSpanElement);
modToggle.addEventListener('click', () => {
  modWrap.hidden = !modWrap.hidden;
  modCaret.textContent = modWrap.hidden ? '▸' : '▾';
});

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

/** Показывает состояние целиком: параметры, высоту, стенку, карточки. */
function showState(state: AppState): void {
  params = stateToParams(state);
  heightMmInput.value = String(state.heightMm);
  wallMm = state.wallMm;
  wallInput.value = String(wallMm);
  profileSel.value = params.profile;
  capsSel.value = params.caps;
  rebuildCards();
  onParamChange();
  refreshPresetList();
}

presetSel.addEventListener('input', () => {
  const ref = presetSel.value;
  if (!isPresetRef(ref)) return;
  const id = ref.slice(2);
  const state = ref.startsWith('b:') ? presetById(id)?.build() : userPresets.find((preset) => preset.id === id)?.state;
  if (!state) return;
  presetRef = ref;
  showState(state);
});

saveBtn.addEventListener('click', () => {
  const name = window.prompt(t('presets.prompt'), currentName() || nextPresetName(userPresets, autoPresetPrefixes(), t('presets.auto')));
  if (!name) return;
  const saved = savePresetAs(userPresets, name, historySnapshot());
  userPresets = saved.list;
  presetRef = makePresetRef('u', saved.id);
  // пресет остаётся в списке до перезагрузки, даже если браузер его не сохранил
  const written = saveRecord(storage, userPresetsRecord, userPresets);
  refreshPresetList();
  if (written !== 'ok') warnings.textContent = t(written === 'full' ? 'kit.storage.preset.saveFull' : 'kit.storage.preset.save');
});

shareBtn.addEventListener('click', () => {
  const token = encodeStateToken(historySnapshot());
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

// --- сборка: превью в главном потоке + полная сетка в worker ---
const scene = createScene(canvas);
let worker: Worker | null = null;
let fullTimer: ReturnType<typeof setTimeout> | null = null;
let lastFullMesh: SurfaceMesh | null = null;
let fullDirty = true;

// --- история: китовая (`core/history`) ---
// Правки идут в неё кадрами (`live`), а шагом (`commit`) становятся, когда
// стихнут на 300 мс: так пачка движений ползунка — один шаг. Таймер уйдёт,
// когда контролы кита скажут о конце правки сами (`final`, m5-controls).
const HISTORY_LIMIT = 100;
const HISTORY_COALESCE_MS = 300;
const history = new History<AppState>(defaultState(), HISTORY_LIMIT);
let historyTimer: ReturnType<typeof setTimeout> | null = null;
/** состояние показывается из истории (отмена, старт): это не правка */
let restoringHistory = false;

function readHeightMm(): number {
  return Math.min(400, Math.max(5, Number(heightMmInput.value) || DEFAULT_HEIGHT_MM));
}

function historySnapshot(): AppState {
  return paramsToState(params, readHeightMm(), wallMm);
}

function syncHistoryButtons(): void {
  undoBtn.disabled = !history.canUndo && historyTimer === null;
  redoBtn.disabled = !history.canRedo;
}

/** Ждущая правка становится шагом. */
function flushHistory(): void {
  if (historyTimer !== null) {
    clearTimeout(historyTimer);
    historyTimer = null;
    history.commit(history.state);
  }
  syncHistoryButtons();
}

function recordHistory(): void {
  if (restoringHistory) return;
  const next = historySnapshot();
  if (JSON.stringify(next) === JSON.stringify(history.state)) return;
  history.live(next);
  if (historyTimer !== null) clearTimeout(historyTimer);
  historyTimer = setTimeout(flushHistory, HISTORY_COALESCE_MS);
  syncHistoryButtons();
}

function restoreHistory(state: AppState): void {
  restoringHistory = true;
  showState(state);
  restoringHistory = false;
  syncHistoryButtons();
}

function undo(): void {
  flushHistory();
  const previous = history.undo();
  if (previous) restoreHistory(previous);
}

function redo(): void {
  flushHistory();
  const next = history.redo();
  if (next) restoreHistory(next);
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

/**
 * Относительная толщина стенки для build: мм → единицы модели. 1 ед. модели =
 * heightMm/modelHeight мм, поэтому wall_rel = wallMm · modelHeight / heightMm.
 * Только для тел вращения в режиме open top; иначе 0 (сплошная модель).
 */
function relativeWall(): number {
  if (params.caps !== 'bottom' || wallMm <= 0 || !isRevolveProfile(params.profile)) return 0;
  const prof = radiusFnFor(params);
  const modelHeight = prof ? prof.height : 1;
  return (wallMm * modelHeight) / readHeightMm();
}

function fullResolution(): number {
  return Number.parseInt(resolutionSel.value, 10) || 256;
}

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
  const tag = full ? `full ${resolutionSel.value}×${resolutionSel.value}` : 'preview';
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

// Слайдер стенки виден только для полого сосуда (open top + тело вращения).
function syncWallRow(): void {
  wallRow.hidden = !(params.caps === 'bottom' && isRevolveProfile(params.profile));
  wallVal.value = String(wallMm);
}

function onParamChange(): void {
  syncShapeCardVisibility();
  syncWallRow();
  params.wall = relativeWall();
  updateModBadges(params.mod);
  rebuildPreview();
  scheduleFullBuild();
  recordHistory();
}

profileSel.addEventListener('input', () => {
  const v = profileSel.value;
  if (isProfileId(v) || v === FOURIER_PROFILE_ID || isShapeId(v)) params.profile = v;
  onParamChange();
});
capsSel.addEventListener('input', () => {
  params.caps = capsSel.value === 'bottom' ? 'bottom' : 'both';
  onParamChange();
});
wallInput.addEventListener('input', () => {
  wallMm = Number(wallInput.value);
  onParamChange();
});
// высота в мм влияет на относительную толщину стенки — пересобрать
heightMmInput.addEventListener('input', () => {
  onParamChange();
});
resolutionSel.addEventListener('input', scheduleFullBuild);

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
  const targetMm = readHeightMm();
  const name = currentName() || params.profile;
  const buf = encodeSTL(mesh, { scale: targetMm / zExtent, name });
  const blob = new Blob([buf], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.stl`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- старт: share-ссылка или дефолты; это начало истории, а не шаг ---
const token = tokenFromHash(location.hash);
const fromUrl = token ? decodeStateToken(token) : null;
restoreHistory(fromUrl ? completeState(fromUrl) : defaultState());
history.reset(historySnapshot());
syncHistoryButtons();
