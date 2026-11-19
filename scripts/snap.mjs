#!/usr/bin/env node
// One debug screenshot in a given state — instead of throwaway inline scripts.
// The server and the browser are the kit's harness (scripts/lib/harness.mjs):
// the project's own port, console and page errors printed.
//
//   node scripts/snap.mjs --out shots/x.png
//   node scripts/snap.mjs --profile torus --out shots/torus.png
//   node scripts/snap.mjs --preset gyroid-sphere --out shots/g.png
//   node scripts/snap.mjs --profile supershape --full --out shots/s.png   # wait for the worker
//   node scripts/snap.mjs --width 390 --height 780 --out shots/mobile.png
//   node scripts/snap.mjs --preset classic-vase --set p_profileShape_belly=0.6 --out shots/x.png
//   node scripts/snap.mjs --lang he --eval "document.getElementById('addRouteBtn').click()" --out shots/he.png
//
// Flags: --lang <en|ru|uk|he> (the browser's language), --preset <id>
//        (src/state/presets.ts; applied first, the other flags edit it),
//        --profile <id>, --caps <both|bottom>, --wall <mm>, --set <id>=<value>
//        (repeatable — any slider or select of the panel by its id; a folded
//        card is opened), --width, --height, --wait <ms> (an extra pause),
//        --full (wait for the worker's full build), --eval <js> (repeatable —
//        prints an expression's value in the page before the shot: where an
//        element is, what it holds; it may act too), --preview (the
//        production build), --out <path> (required). Prints #status and
//        the errors.

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

/** --lang: the browser's language — the app picks by it, as for a person */
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
   * Sets a panel row by its id: a select by choosing, a slider as if
   * released (input, then change — a finished edit). Unfolds a folded card
   * first: a control in it is not visible.
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
  // --full: the status tells the full build in any language (`data-build`)
  if (flags.has('full')) await page.waitForSelector('#status[data-build="full"]', { timeout: 30000 });
  if (flags.has('wait')) await page.waitForTimeout(Number(flags.get('wait')));

  // --eval: an expression's value in the page before the shot — where an element
  // is, what it holds; it may act too (`document.getElementById('addRouteBtn').click()`)
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
