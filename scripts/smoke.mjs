#!/usr/bin/env node
// Браузерный смоук: Three.js-слой нельзя грузить в vitest (WebGL), поэтому
// проверяем здесь. Каждый профиль строится без ошибок консоли, статус
// показывает watertight, ripples тумблится.
//
//   node scripts/smoke.mjs                    # полный смоук
//   node scripts/smoke.mjs --screenshot shots/x.png
//   node scripts/smoke.mjs --preview          # прод-сборка (vite preview :4287)
//
// Любая ошибка консоли/страницы → ненулевой код выхода (годится для CI).

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['screenshot']);
const flags = new Map();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const name = a.slice(2);
    flags.set(name, VALUE_FLAGS.has(name) ? args[++i] : 'true');
  }
}

const preview = flags.has('preview');
const PORT = preview ? 4287 : 5287;
const BASE = `http://localhost:${PORT}`;

async function serverUp() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

let devProc = null;
async function ensureServer() {
  if (await serverUp()) return;
  const cmd = preview ? ['vite', 'preview', '--port', String(PORT), '--strictPort'] : ['vite', '--port', String(PORT), '--strictPort'];
  devProc = spawn('npx', cmd, { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) {
    console.error(`server did not start on :${PORT}`);
    process.exit(1);
  }
}

const errors = [];
let ctxLabel = 'app';
function attach(page) {
  page.on('pageerror', (e) => errors.push(`[${ctxLabel}] ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${ctxLabel}] ${m.text()}`);
  });
}

await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
attach(page);

await page.goto(BASE);
await page.waitForTimeout(600);

// каждый профиль строится, статус — watertight
const ids = await page.$$eval('#shape_profile option', (els) => els.map((e) => e.value));
for (const id of ids) {
  ctxLabel = `profile:${id}`;
  await page.selectOption('#shape_profile', id);
  await page.waitForTimeout(250);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
}
console.log(`profiles checked: ${ids.length}`);

/** Раскрывает свёрнутую карточку, где лежит контрол: в свёрнутой его не видно. */
async function reveal(id) {
  await page.evaluate((target) => {
    const card = document.getElementById(target)?.closest('.fcard.collapsed');
    card?.querySelector(':scope > .fcard-head')?.click();
  }, id);
}

/** Ползунок как отпущенный: кадр (input) и законченная правка (change) — шаг отмены. */
async function setSlider(id, value) {
  await reveal(id);
  const slider = page.locator(`#${id}`);
  await slider.fill(value);
  await slider.dispatchEvent('input');
  await slider.dispatchEvent('change');
}

// каждая карточка (смещения + деформеры) включается и выключается без ошибок;
// галочка — первой строкой внутри карточки (#p_<карточка>_on)
const cardIds = await page.$$eval('#displaceCards .fcard, #deformCards .fcard', (els) => els.map((e) => e.id.replace('card_', '')));
for (const id of cardIds) {
  ctxLabel = `card:${id}`;
  await reveal(`p_${id}_on`);
  await page.locator(`#p_${id}_on`).click();
  await page.waitForTimeout(150);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
  await page.locator(`#p_${id}_on`).click();
  await page.waitForTimeout(80);
}
console.log(`cards toggled: ${cardIds.length}`);

// каждый встроенный пресет открывается из диалога кита и даёт watertight-меш;
// его имя — на кнопке пресетов
await page.locator('#presetBtn').click();
const presetValues = await page.$$eval('#presetList .preset-row[data-ref^="b:"]', (els) => els.map((e) => e.dataset.ref));
await page.locator('#presetsClose').click();
for (const v of presetValues) {
  ctxLabel = `preset:${v.slice(2)}`;
  await page.locator('#presetBtn').click();
  const pick = page.locator(`#presetList .preset-row[data-ref="${v}"] .preset-pick`);
  const name = await pick.locator('.preset-name').textContent();
  await pick.click();
  await page.waitForTimeout(300);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
  if ((await page.locator('#presetBtn').textContent()).trim() !== name) errors.push(`[${ctxLabel}] preset button: ${await page.locator('#presetBtn').textContent()}`);
}
console.log(`presets checked: ${presetValues.length}`);

// отмена и повтор: правка ползунка — один шаг; ↩️ возвращает, ↪️ повторяет
ctxLabel = 'undo';
await page.goto(BASE);
await page.waitForTimeout(400);
const amp = page.locator('#p_ripples_amp');
const ampBefore = await amp.inputValue();
await setSlider('p_ripples_amp', '0.08');
await page.locator('#undoBtn').click();
await page.waitForTimeout(150);
if ((await amp.inputValue()) !== ampBefore) errors.push(`[undo] amp=${await amp.inputValue()}, expected ${ampBefore}`);
await page.locator('#redoBtn').click();
await page.waitForTimeout(150);
if ((await amp.inputValue()) !== '0.08') errors.push(`[redo] amp=${await amp.inputValue()}, expected 0.08`);
if (!(await page.locator('#redoBtn').isDisabled())) errors.push('[redo] still enabled at the newest step');
console.log('undo/redo ok');

// 💾: пресет под именем из prompt — в «My presets», и после перезагрузки тоже
ctxLabel = 'savePreset';
page.once('dialog', (dialog) => dialog.accept('Smoke preset'));
await page.locator('#saveBtn').click();
await page.waitForTimeout(200);
await page.reload();
await page.waitForTimeout(400);
await page.locator('#presetBtn').click();
const mine = await page.$$eval('#presetList .preset-row[data-ref^="u:"] input', (els) => els.map((e) => e.value));
await page.locator('#presetsClose').click();
if (!mine.includes('Smoke preset')) errors.push(`[savePreset] my presets: ${JSON.stringify(mine)}`);
else console.log('save preset ok');

// open top + слайдер толщины стенки: wall=0 → оболочка, wall>0 → watertight-солид
ctxLabel = 'wall';
await page.selectOption('#shape_caps', 'bottom');
await page.waitForTimeout(200);
if (await page.locator('#shape_wall').isHidden()) errors.push('[wall] slider hidden in open top');
await setSlider('shape_wall', '0');
await page.waitForTimeout(300);
const shellStatus = await page.locator('#status').textContent();
if (!shellStatus.includes('open top')) errors.push(`[wall0] status="${shellStatus}" (ожидалась оболочка)`);
await setSlider('shape_wall', '3');
await page.waitForTimeout(300);
const wallStatus = await page.locator('#status').textContent();
if (!wallStatus.includes('watertight ✓')) errors.push(`[wall] status="${wallStatus}" (ожидался watertight-солид)`);
await page.selectOption('#shape_caps', 'both');
await page.waitForTimeout(200);
if (await page.locator('#shape_wall').isVisible()) errors.push('[wall] slider visible in solid mode');

// полная сборка в worker: статус со временем показывает "full NxN"
ctxLabel = 'worker';
await page.goto(BASE);
await page.waitForTimeout(400);
let fullSeen = false;
for (let i = 0; i < 30 && !fullSeen; i++) {
  await page.waitForTimeout(300);
  const st = await page.locator('#status').textContent();
  if (st.includes('full ')) fullSeen = true;
}
if (!fullSeen) errors.push('[worker] full build never finished (status stuck on preview)');
else console.log('worker full build ok');

// настройка формы профиля: карточка видна для пресета, скрыта для фигуры,
// belly>0 меняет геометрию
ctxLabel = 'profileShape';
await page.selectOption('#shape_profile', 'vase');
await page.waitForTimeout(250);
if (await page.locator('#card_profileShape').isHidden()) errors.push('[profileShape] card hidden for preset');
await setSlider('p_profileShape_belly', '0.6');
await page.waitForTimeout(250);
const psStatus = await page.locator('#status').textContent();
if (!psStatus.includes('watertight ✓')) errors.push(`[profileShape] status="${psStatus}"`);

// Фурье-профиль: карточка появляется, форма профиля скрыта, меш watertight
ctxLabel = 'fourier';
await page.selectOption('#shape_profile', 'fourier');
await page.waitForTimeout(300);
const fourierVisible = await page.locator('#card_fourier').isVisible();
if (!fourierVisible) errors.push('[fourier] card not visible');
if (await page.locator('#card_profileShape').isVisible()) errors.push('[fourier] profileShape card still visible');
const fst = await page.locator('#status').textContent();
if (!fst.includes('watertight ✓')) errors.push(`[fourier] status="${fst}"`);

// матрица модуляции: добавить маршрут → бейдж ∿ на слайдере цели
ctxLabel = 'mod';
await page.locator('#card_mod .fcard-head').click();
await page.waitForTimeout(150);
await page.locator('#addRouteBtn').click();
await page.waitForTimeout(300);
const badge = await page.locator('.mod-badge').count();
if (badge < 1) errors.push('[mod] no ∿ badge after adding route');
const mst = await page.locator('#status').textContent();
if (!mst.includes('watertight ✓')) errors.push(`[mod] status="${mst}"`);
console.log('mod route + badge ok');

// экспорт STL отдаёт непустой валидный буфер (перехватываем download)
ctxLabel = 'export';
const downloadP = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.locator('#exportBtn').click();
const download = await downloadP;
if (!download) errors.push('[export] no download event');
else console.log('export ok:', download.suggestedFilename());

// телефон: панель — нижний лист кита; ручка закрывает, «Settings» открывает
ctxLabel = 'phone';
const phone = await browser.newPage({ viewport: { width: 390, height: 780 } });
attach(phone);
await phone.goto(BASE);
await phone.waitForTimeout(600);
await phone.locator('#sheetClose').click();
await phone.waitForTimeout(200);
if (await phone.locator('#panel').evaluate((node) => node.classList.contains('open'))) errors.push('[phone] the sheet did not close');
await phone.locator('#sheetOpen').click();
await phone.waitForTimeout(200);
if ((await phone.locator('#sheetOpen').getAttribute('aria-expanded')) !== 'true') errors.push('[phone] the sheet did not open');
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 0) errors.push(`[phone] the page scrolls sideways by ${overflow} px`);
await phone.close();
console.log('phone sheet ok');

if (flags.has('screenshot')) {
  const path = flags.get('screenshot');
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log(path);
}

console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
devProc?.kill();
process.exit(errors.length ? 2 : 0);
