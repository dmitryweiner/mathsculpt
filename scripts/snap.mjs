#!/usr/bin/env node
// Гибкий одиночный скриншот для отладки — заменяет одноразовые inline-скрипты.
// Сервер и браузер — китовой обвязки (scripts/lib/harness.mjs): свой порт,
// ошибки консоли/страницы печатаются.
//
//   node scripts/snap.mjs --out shots/x.png
//   node scripts/snap.mjs --profile torus --out shots/torus.png
//   node scripts/snap.mjs --preset gyroid-sphere --out shots/g.png
//   node scripts/snap.mjs --profile supershape --full --out shots/s.png   # дождаться воркера
//   node scripts/snap.mjs --width 390 --height 780 --out shots/mobile.png
//   node scripts/snap.mjs --preset classic-vase --set p_profileShape_belly=0.6 --out shots/x.png
//   node scripts/snap.mjs --lang he --eval "document.getElementById('addRouteBtn').click()" --out shots/he.png
//
// Флаги: --lang <en|ru|uk|he> (язык браузера), --preset <id>
//        (src/state/presets.ts; ставится первым — остальное правит его),
//        --profile <id>, --caps <both|bottom>, --wall <mm>, --set <id>=<value>
//        (повторяемый — любой ползунок или селект панели по id, свёрнутая
//        карточка раскрывается), --width, --height, --wait <ms> (доп.
//        пауза), --full (ждать полной сборки в воркере), --eval <js>
//        (повторяемый — печатает значение выражения на странице до кадра:
//        где элемент, что в нём; может и действовать), --preview (прод-сборка),
//        --out <path> (обязателен). Печатает #status и ошибки.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { check, launch, parseArgs, VIEWPORTS } from './lib/harness.mjs';

const flags = parseArgs(
  process.argv.slice(2),
  ['lang', 'profile', 'preset', 'caps', 'wall', 'width', 'height', 'wait', 'out'],
  ['set', 'eval'],
);
const out = flags.get('out');
if (!out) {
  console.error('need --out <path>');
  process.exit(1);
}

/** --lang: язык браузера — приложение выбирает по нему, как у человека */
const LOCALES = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', he: 'he-IL' };

const app = await launch({ preview: flags.has('preview') });
await app.run(async () => {
  const { page, context } = await app.open({
    viewport: {
      width: Number(flags.get('width')) || VIEWPORTS.desktop.width,
      height: Number(flags.get('height')) || VIEWPORTS.desktop.height,
    },
    locale: LOCALES[flags.get('lang')] ?? 'en-US',
  });
  await page.waitForSelector('#status[data-build]');

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
    check((await control.count()) === 1, `no control #${id}`);
    if ((await control.evaluate((node) => node.tagName)) === 'SELECT') {
      await control.selectOption(value);
    } else {
      await control.fill(value);
      await control.dispatchEvent('input');
      await control.dispatchEvent('change');
    }
    await page.waitForTimeout(250);
  }

  if (flags.has('preset')) {
    await page.locator('#presetBtn').click();
    await page.locator(`#presetList .preset-row[data-ref="b:${flags.get('preset')}"] .preset-pick`).click();
    await page.waitForTimeout(350);
  }
  if (flags.has('profile')) await setControl('shape_profile', flags.get('profile'));
  if (flags.has('caps')) await setControl('shape_caps', flags.get('caps'));
  if (flags.has('wall')) await setControl('shape_wall', flags.get('wall'));
  for (const pair of flags.get('set') ?? []) {
    const eq = pair.indexOf('=');
    await setControl(pair.slice(0, eq), pair.slice(eq + 1));
  }
  // --full: статус говорит о полной сборке на любом языке (`data-build`)
  if (flags.has('full')) await page.waitForSelector('#status[data-build="full"]', { timeout: 30000 });
  if (flags.has('wait')) await page.waitForTimeout(Number(flags.get('wait')));

  // --eval: значение выражения на странице до кадра — где элемент, что в нём;
  // выражение может и действовать (`document.getElementById('addRouteBtn').click()`)
  for (const expression of flags.get('eval') ?? []) {
    console.log(`eval ${expression}:`, JSON.stringify(await page.evaluate(expression)));
    await page.waitForTimeout(200);
  }
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(out);
  console.log('status:', await page.locator('#status').textContent());
  await context.close();
}, 'snap done');
