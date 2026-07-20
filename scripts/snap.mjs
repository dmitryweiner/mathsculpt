#!/usr/bin/env node
// Гибкий одиночный скриншот для отладки — заменяет одноразовые inline-скрипты.
// Поднимает dev-сервер при необходимости, ловит ошибки консоли/страницы.
//
//   node scripts/snap.mjs --out shots/x.png
//   node scripts/snap.mjs --profile torus --out shots/torus.png
//   node scripts/snap.mjs --preset "Gyroid sphere" --out shots/g.png
//   node scripts/snap.mjs --profile supershape --full --out shots/s.png   # дождаться worker
//   node scripts/snap.mjs --width 390 --height 780 --out shots/mobile.png
//   node scripts/snap.mjs --hash <token> --out shots/shared.png
//   node scripts/snap.mjs --profile vase --set p_profileShape_belly=0.6 --out shots/x.png
//
// Флаги: --profile <id>, --preset <name>, --hash <token>, --caps <both|bottom>,
//        --wall <mm>, --set <id>=<value> (повторяемый — любой input/slider),
//        --width, --height, --wait <ms> (доп. пауза), --full (ждать полной
//        сборки в worker), --out <path> (обязателен). Печатает #status и ошибки.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['profile', 'preset', 'hash', 'caps', 'wall', 'width', 'height', 'wait', 'out']);
const flags = new Map();
const sets = []; // --set id=value (повторяемый): выставить любой input/slider
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--set') {
    sets.push(args[++i]);
  } else if (a.startsWith('--')) {
    const name = a.slice(2);
    flags.set(name, VALUE_FLAGS.has(name) ? args[++i] : 'true');
  }
}

const out = flags.get('out');
if (!out) {
  console.error('need --out <path>');
  process.exit(1);
}

const PORT = 5173;
const BASE = `http://localhost:${PORT}`;

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}

let devProc = null;
if (!(await serverUp())) {
  devProc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) { console.error(`server did not start on :${PORT}`); process.exit(1); }
}

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(flags.get('width')) || 1280, height: Number(flags.get('height')) || 820 },
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const url = flags.has('hash') ? `${BASE}/#s=${flags.get('hash')}` : BASE;
await page.goto(url);
await page.waitForTimeout(600);

if (flags.has('profile')) {
  await page.selectOption('#profile', flags.get('profile'));
  await page.waitForTimeout(350);
}
if (flags.has('caps')) {
  await page.selectOption('#caps', flags.get('caps'));
  await page.waitForTimeout(300);
}
if (flags.has('wall')) {
  await page.locator('#wallMm').fill(flags.get('wall'));
  await page.locator('#wallMm').dispatchEvent('input');
  await page.waitForTimeout(300);
}
for (const pair of sets) {
  const eq = pair.indexOf('=');
  const id = pair.slice(0, eq);
  const value = pair.slice(eq + 1);
  await page.locator(`#${id}`).fill(value);
  await page.locator(`#${id}`).dispatchEvent('input');
  await page.waitForTimeout(200);
}
if (flags.has('preset')) {
  await page.selectOption('#presetSel', `b:${flags.get('preset')}`);
  await page.waitForTimeout(350);
}
// --full: дождаться, пока статус перестанет быть "preview" (worker закончил)
if (flags.has('full')) {
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(300);
    if ((await page.locator('#status').textContent()).includes('full ')) break;
  }
}
if (flags.has('wait')) await page.waitForTimeout(Number(flags.get('wait')));

mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(out);
console.log('status:', await page.locator('#status').textContent());
if (errors.length) console.log('errors:', errors);

await browser.close();
devProc?.kill();
