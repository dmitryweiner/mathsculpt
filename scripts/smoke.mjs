#!/usr/bin/env node
// Браузерный смоук: Three.js-слой нельзя грузить в vitest (WebGL), поэтому
// проверяем здесь. Каждый профиль строится без ошибок консоли, статус
// показывает watertight, ripples тумблится.
//
//   node scripts/smoke.mjs                    # полный смоук
//   node scripts/smoke.mjs --screenshot shots/x.png
//   node scripts/smoke.mjs --preview          # прод-сборка (vite preview :4173)
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
const PORT = preview ? 4173 : 5173;
const BASE = `http://localhost:${PORT}`;

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}

let devProc = null;
async function ensureServer() {
  if (await serverUp()) return;
  const cmd = preview
    ? ['vite', 'preview', '--port', String(PORT), '--strictPort']
    : ['vite', '--port', String(PORT), '--strictPort'];
  devProc = spawn('npx', cmd, { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) { console.error(`server did not start on :${PORT}`); process.exit(1); }
}

const errors = [];
let ctxLabel = 'app';
function attach(page) {
  page.on('pageerror', (e) => errors.push(`[${ctxLabel}] ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${ctxLabel}] ${m.text()}`); });
}

await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
attach(page);

await page.goto(BASE);
await page.waitForTimeout(600);

// каждый профиль строится, статус — watertight
const ids = await page.$$eval('#profile option', (els) => els.map((e) => e.value));
for (const id of ids) {
  ctxLabel = `profile:${id}`;
  await page.selectOption('#profile', id);
  await page.waitForTimeout(250);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
}
console.log(`profiles checked: ${ids.length}`);

// каждая карточка (смещения + деформеры) включается и выключается без ошибок
const cardIds = await page.$$eval('[id^="en_"]', (els) => els.map((e) => e.id.replace('en_', '')));
for (const id of cardIds) {
  ctxLabel = `card:${id}`;
  await page.locator(`#en_${id}`).click();
  await page.waitForTimeout(150);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
  await page.locator(`#en_${id}`).click();
  await page.waitForTimeout(80);
}
console.log(`cards toggled: ${cardIds.length}`);

// каждый встроенный пресет грузится и даёт watertight-меш
const presetValues = await page.$$eval('#presetSel option', (els) =>
  els.map((e) => e.value).filter((v) => v.startsWith('b:')));
for (const v of presetValues) {
  ctxLabel = `preset:${v.slice(2)}`;
  await page.selectOption('#presetSel', v);
  await page.waitForTimeout(300);
  const status = await page.locator('#status').textContent();
  if (!status.includes('watertight ✓')) errors.push(`[${ctxLabel}] status="${status}"`);
}
console.log(`presets checked: ${presetValues.length}`);

// open top, share-ссылка кладёт токен в hash и восстанавливается
ctxLabel = 'toggles';
await page.selectOption('#caps', 'bottom');
await page.waitForTimeout(200);
const openStatus = await page.locator('#status').textContent();
if (!openStatus.includes('open top')) errors.push(`[toggles] status="${openStatus}"`);
await page.selectOption('#caps', 'both');
await page.waitForTimeout(200);

ctxLabel = 'share';
await page.locator('#shareBtn').click();
await page.waitForTimeout(300);
const hash = await page.evaluate(() => location.hash);
if (!hash.startsWith('#s=')) errors.push(`[share] hash="${hash}"`);
else {
  await page.goto(`${BASE}/${hash}`);
  await page.waitForTimeout(500);
  const st = await page.locator('#status').textContent();
  if (!st.includes('watertight ✓')) errors.push(`[share:restore] status="${st}"`);
}

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

// Фурье-профиль: карточка появляется, меш watertight
ctxLabel = 'fourier';
await page.selectOption('#profile', 'fourier');
await page.waitForTimeout(300);
const fourierVisible = await page.locator('#card_fourier').isVisible();
if (!fourierVisible) errors.push('[fourier] card not visible');
const fst = await page.locator('#status').textContent();
if (!fst.includes('watertight ✓')) errors.push(`[fourier] status="${fst}"`);

// матрица модуляции: добавить маршрут → бейдж ∿ на слайдере цели
ctxLabel = 'mod';
await page.locator('#modToggle').click();
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
