// Сборка UI: топбар (пресеты, Save, Share, Export), карточки смещений и
// деформеров, Фурье-профиль, матрица модуляции, график r(z).
// Превью 96×96 строится в главном потоке мгновенно; полная сетка — в
// Web Worker с прогресс-баром (паттерн mandelbulb-worker).
import './style.css';
import type { BuildParams } from './geo/build';
import { buildMesh, defaultParams, radiusFnFor } from './geo/build';
import type { SurfaceMesh } from './geo/surface';
import { PROFILES, isProfileId, FOURIER_PROFILE_ID } from './geo/profiles';
import { SHAPE_IDS, isShapeId } from './geo/shapes';
import { validateMesh, overhangFraction } from './geo/validate';
import type { MeshReport } from './geo/validate';
import { encodeSTL } from './geo/stl';
import { createScene } from './render/scene';
import { DISPLACE_CARDS, DEFORM_CARDS, FOURIER_CARD, SHAPE_CARDS } from './formulas';
import type { CardHandles } from './ui/cards';
import { buildCard } from './ui/cards';
import { setupAdjustmentButtons } from './ui/adjust';
import { el } from './ui/dom';
import { drawProfileGraph } from './ui/graph';
import { buildModPanel, updateModBadges } from './ui/modmatrix';
import { DEFAULT_HEIGHT_MM, paramsToState, stateToParams, sanitizeState } from './state/schema';
import type { PartialAppState } from './state/schema';
import { encodeStateToken, decodeStateToken, tokenFromHash } from './state/share';
import { PRESETS } from './presets';
import { loadUserPresets, saveUserPresets, nextPresetNumber } from './state/userPresets';

const PREVIEW_N = 96;

const profileSel = el('profile', HTMLSelectElement);
const capsSel = el('caps', HTMLSelectElement);
const resolutionSel = el('resolution', HTMLSelectElement);
const presetSel = el('presetSel', HTMLSelectElement);
const heightMmInput = el('heightMm', HTMLInputElement);
const saveBtn = el('saveBtn', HTMLButtonElement);
const shareBtn = el('shareBtn', HTMLButtonElement);
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
let presetName = '';

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

/** Видимость карточек Фурье/фигур: показывается только выбранный носитель. */
function syncShapeCardVisibility(): void {
  fourierWrap.hidden = false;
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

// --- пресеты ---
function refreshPresetList(): void {
  presetSel.innerHTML = '';
  const custom = document.createElement('option');
  custom.value = '';
  custom.textContent = presetName ? `● ${presetName}` : '— preset —';
  presetSel.appendChild(custom);
  const builtins = document.createElement('optgroup');
  builtins.label = 'Built-in';
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = `b:${p.name}`;
    opt.textContent = p.name;
    builtins.appendChild(opt);
  }
  presetSel.appendChild(builtins);
  const users = loadUserPresets();
  if (users.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'My presets';
    for (const p of users) {
      const opt = document.createElement('option');
      opt.value = `u:${p.name}`;
      opt.textContent = p.name;
      grp.appendChild(opt);
    }
    presetSel.appendChild(grp);
  }
  presetSel.value = '';
}

function applyState(partial: PartialAppState): void {
  params = stateToParams(partial);
  presetName = partial.presetName ?? '';
  if (typeof partial.heightMm === 'number') heightMmInput.value = String(partial.heightMm);
  profileSel.value = params.profile;
  capsSel.value = params.caps;
  rebuildCards();
  onParamChange();
  refreshPresetList();
}

presetSel.addEventListener('input', () => {
  const v = presetSel.value;
  if (v.startsWith('b:')) {
    const preset = PRESETS.find((p) => p.name === v.slice(2));
    if (preset) applyState({ ...preset.state, presetName: preset.name });
  } else if (v.startsWith('u:')) {
    const preset = loadUserPresets().find((p) => p.name === v.slice(2));
    if (preset) {
      const st = sanitizeState(preset.state);
      if (st) applyState({ ...st, presetName: preset.name });
    }
  }
});

saveBtn.addEventListener('click', () => {
  const users = loadUserPresets();
  const name = window.prompt('Preset name:', presetName || `Preset ${nextPresetNumber(users)}`);
  if (!name) return;
  const state = paramsToState(params, readHeightMm(), name);
  const idx = users.findIndex((p) => p.name === name);
  if (idx >= 0) users[idx] = { name, state };
  else users.push({ name, state });
  saveUserPresets(users);
  presetName = name;
  refreshPresetList();
});

shareBtn.addEventListener('click', () => {
  const token = encodeStateToken(paramsToState(params, readHeightMm(), presetName || undefined));
  const url = `${location.origin}${location.pathname}#s=${token}`;
  history.replaceState(null, '', `#s=${token}`);
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

function readHeightMm(): number {
  return Math.min(400, Math.max(5, Number(heightMmInput.value) || DEFAULT_HEIGHT_MM));
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
  const closed = params.caps === 'both'
    ? (report.watertight ? 'watertight ✓' : 'NOT watertight ✗')
    : 'open top';
  const tag = full ? `full ${resolutionSel.value}×${resolutionSel.value}` : 'preview';
  status.textContent = `${kTris}k triangles · ${closed} · ${tag} · ${buildMs.toFixed(0)} ms`;
  const out: string[] = [];
  if (!report.finite) out.push('⚠ Non-finite vertices — check parameters');
  if (params.caps === 'both' && !report.watertight) out.push('⚠ Mesh is not watertight');
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

function onParamChange(): void {
  syncShapeCardVisibility();
  updateModBadges(params.mod);
  rebuildPreview();
  scheduleFullBuild();
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
resolutionSel.addEventListener('input', scheduleFullBuild);

// --- экспорт ---
exportBtn.addEventListener('click', () => {
  const mesh = fullDirty || !lastFullMesh
    ? buildMesh({ ...params, nu: fullResolution(), nv: fullResolution() })
    : lastFullMesh;
  const report = validateMesh(mesh);
  const zExtent = report.bbox.max[2] - report.bbox.min[2];
  const targetMm = readHeightMm();
  const name = presetName || params.profile;
  const buf = encodeSTL(mesh, { scale: targetMm / zExtent, name });
  const blob = new Blob([buf], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.stl`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// --- старт: share-ссылка или дефолты ---
const token = tokenFromHash(location.hash);
const fromUrl = token ? decodeStateToken(token) : null;
if (fromUrl) {
  applyState(fromUrl);
} else {
  rebuildCards();
  refreshPresetList();
  onParamChange();
}
