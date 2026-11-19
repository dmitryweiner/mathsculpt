#!/usr/bin/env node
// Гибкий одиночный скриншот для отладки — заменяет одноразовые inline-скрипты.
// Поднимает dev-сервер при необходимости, ловит ошибки консоли/страницы.
//
//   node scripts/snap.mjs --out shots/x.png
//   node scripts/snap.mjs --profile torus --out shots/torus.png
//   node scripts/snap.mjs --preset gyroid-sphere --out shots/g.png
//   node scripts/snap.mjs --profile supershape --full --out shots/s.png   # дождаться worker
//   node scripts/snap.mjs --width 390 --height 780 --out shots/mobile.png
//   node scripts/snap.mjs --profile vase --set p_profileShape_belly=0.6 --out shots/x.png
//
// Флаги: --lang <en|ru|uk|he> (язык браузера), --profile <id>, --preset <id> (src/state/presets.ts), --caps <both|bottom>,
//        --wall <mm>, --set <id>=<value> (повторяемый — любой ползунок или
//        селект панели по id, свёрнутая карточка раскрывается),
//        --width, --height, --wait <ms> (доп. пауза), --full (ждать полной
//        сборки в worker), --eval <js> (повторяемый — печатает значение
//        выражения на странице: где элемент, что в нём), --out <path>
//        (обязателен). Печатает #status и ошибки.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['lang', 'profile', 'preset', 'caps', 'wall', 'width', 'height', 'wait', 'out']);
const flags = new Map();
const sets = []; // --set id=value (повторяемый): выставить любой input/slider
const evals = []; // --eval <js> (повторяемый): напечатать значение выражения на странице
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--set') {
    sets.push(args[++i]);
  } else if (a === '--eval') {
    evals.push(args[++i]);
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

const PORT = 5287;
const BASE = `http://localhost:${PORT}`;

async function serverUp() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

let devProc = null;
if (!(await serverUp())) {
  devProc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) {
    console.error(`server did not start on :${PORT}`);
    process.exit(1);
  }
}

const errors = [];
const browser = await chromium.launch();
// --lang: язык браузера (en, ru, uk, he) — приложение выбирает по нему, как у человека
const LOCALES = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', he: 'he-IL' };
const page = await browser.newPage({
  viewport: { width: Number(flags.get('width')) || 1280, height: Number(flags.get('height')) || 820 },
  locale: LOCALES[flags.get('lang')] ?? 'en-US',
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(BASE);
await page.waitForTimeout(600);

/**
 * Ставит значение строке панели по id: селекту — выбором, ползунку — как
 * отпущенному (input, затем change — законченная правка). Свёрнутую
 * карточку сначала раскрывает: контрол в ней не виден.
 */
async function setControl(id, value) {
  await page.evaluate((target) => {
    const card = document.getElementById(target)?.closest('.fcard.collapsed');
    card?.querySelector(':scope > .fcard-head')?.click();
  }, id);
  const control = page.locator(`#${id}`);
  if ((await control.evaluate((node) => node.tagName)) === 'SELECT') {
    await control.selectOption(value);
  } else {
    await control.fill(value);
    await control.dispatchEvent('input');
    await control.dispatchEvent('change');
  }
  await page.waitForTimeout(250);
}

if (flags.has('profile')) await setControl('shape_profile', flags.get('profile'));
if (flags.has('caps')) await setControl('shape_caps', flags.get('caps'));
if (flags.has('wall')) await setControl('shape_wall', flags.get('wall'));
for (const pair of sets) {
  const eq = pair.indexOf('=');
  await setControl(pair.slice(0, eq), pair.slice(eq + 1));
}
if (flags.has('preset')) {
  await page.locator('#presetBtn').click();
  await page.locator(`#presetList .preset-row[data-ref="b:${flags.get('preset')}"] .preset-pick`).click();
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

// --eval: значение выражения на странице до кадра — где элемент, что в нём;
// выражение может и действовать (`document.getElementById('addRouteBtn').click()`)
for (const expression of evals) {
  console.log(`eval ${expression}:`, JSON.stringify(await page.evaluate(expression)));
  await page.waitForTimeout(200);
}
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(out);
console.log('status:', await page.locator('#status').textContent());
if (errors.length) console.log('errors:', errors);

await browser.close();
devProc?.kill();
