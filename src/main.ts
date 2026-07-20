// Сборка UI: топбар (пресеты, Save, Share, Export), карточки смещений и
// деформеров, статус и предупреждения печатности.
import './style.css';
import type { BuildParams } from './geo/build';
import { buildMesh, defaultParams } from './geo/build';
import { PROFILES, isProfileId, profileById, profileRadius } from './geo/profiles';
import { validateMesh, overhangFraction } from './geo/validate';
import { encodeSTL } from './geo/stl';
import { createScene } from './render/scene';
import { DISPLACE_CARDS, DEFORM_CARDS } from './formulas';
import type { CardHandles } from './ui/cards';
import { buildCard } from './ui/cards';
import { setupAdjustmentButtons } from './ui/adjust';
import { el } from './ui/dom';
import { DEFAULT_HEIGHT_MM, paramsToState, stateToParams, sanitizeState } from './state/schema';
import type { PartialAppState } from './state/schema';
import { encodeStateToken, decodeStateToken, tokenFromHash } from './state/share';
import { PRESETS } from './presets';
import { loadUserPresets, saveUserPresets, nextPresetNumber } from './state/userPresets';

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

// --- карточки ---
const cardHandles: CardHandles[] = [];
const displaceWrap = el('displaceCards', HTMLDivElement);
const deformWrap = el('deformCards', HTMLDivElement);
setupAdjustmentButtons(el('panel', HTMLElement));

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
  syncControls();
  rebuildCards();
  rebuild();
  refreshPresetList();
}

function syncControls(): void {
  profileSel.value = params.profile;
  capsSel.value = params.caps;
}

/** Пересоздаёт привязку карточек к новому объекту params. */
function rebuildCards(): void {
  cardHandles.length = 0;
  displaceWrap.innerHTML = '';
  for (const def of DISPLACE_CARDS) {
    const h = buildCard(def, params.displace[def.id], rebuild);
    cardHandles.push(h);
    displaceWrap.appendChild(h.root);
  }
  deformWrap.innerHTML = '';
  for (const def of DEFORM_CARDS) {
    const h = buildCard(def, params.deform[def.id], rebuild);
    cardHandles.push(h);
    deformWrap.appendChild(h.root);
  }
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

// --- сборка и статус ---
const scene = createScene(canvas);

function readHeightMm(): number {
  return Math.min(400, Math.max(5, Number(heightMmInput.value) || DEFAULT_HEIGHT_MM));
}

function minProfileRadius(): number {
  const def = profileById(params.profile);
  let min = Infinity;
  for (let i = 0; i <= 100; i++) min = Math.min(min, profileRadius(def, i / 100));
  return min;
}

function collectWarnings(mesh: Parameters<typeof overhangFraction>[0], watertightExpected: boolean, report: { watertight: boolean; finite: boolean }): string {
  const out: string[] = [];
  if (!report.finite) out.push('⚠ Non-finite vertices — check parameters');
  if (watertightExpected && !report.watertight) out.push('⚠ Mesh is not watertight');
  const over = overhangFraction(mesh);
  if (over > 0.02) out.push(`⚠ Overhangs steeper than 60°: ${(over * 100).toFixed(0)}% of surface (hard to FDM-print)`);
  let ampBudget = 0;
  for (const card of Object.values(params.displace)) {
    if (card.on) ampBudget += Math.abs(card.params.amp ?? 0);
  }
  if (ampBudget > minProfileRadius()) {
    out.push('⚠ Displacement amplitude exceeds local radius — possible self-intersections');
  }
  return out.join('\n');
}

function rebuild(): void {
  const t0 = performance.now();
  const n = Number.parseInt(resolutionSel.value, 10);
  params.nu = n;
  params.nv = n;
  const mesh = buildMesh(params);
  scene.setMesh(mesh);
  const report = validateMesh(mesh);
  const dt = performance.now() - t0;
  const kTris = (report.triangleCount / 1000).toFixed(1);
  const closed = params.caps === 'both'
    ? (report.watertight ? 'watertight ✓' : 'NOT watertight ✗')
    : 'open top';
  status.textContent = `${kTris}k triangles · ${closed} · ${dt.toFixed(0)} ms`;
  warnings.textContent = collectWarnings(mesh, params.caps === 'both', report);
}

profileSel.addEventListener('input', () => {
  if (isProfileId(profileSel.value)) params.profile = profileSel.value;
  rebuild();
});
capsSel.addEventListener('input', () => {
  params.caps = capsSel.value === 'bottom' ? 'bottom' : 'both';
  rebuild();
});
resolutionSel.addEventListener('input', rebuild);

// --- экспорт ---
exportBtn.addEventListener('click', () => {
  const mesh = buildMesh(params);
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
  rebuild();
}
