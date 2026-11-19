#!/usr/bin/env node
// Скриншоты превью: по одному на каждый профиль → ./shots (или --out <dir>).
// Сервер и браузер — китовой обвязки (scripts/lib/harness.mjs).
//
//   node scripts/shot.mjs                 # dev-сервер (:5287)
//   node scripts/shot.mjs --out shots/p   # в другую папку

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, parseArgs, VIEWPORTS } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2), ['out']);
const dir = flags.get('out') ?? 'shots';
mkdirSync(dir, { recursive: true });

const app = await launch({ preview: flags.has('preview') });
await app.run(async () => {
  const { page, context } = await app.open({ viewport: VIEWPORTS.desktop, locale: 'en-US' });
  await page.waitForSelector('#status[data-build]');
  const ids = await page.$$eval('#shape_profile option', (els) => els.map((e) => e.value));
  for (const id of ids) {
    await page.selectOption('#shape_profile', id);
    await page.waitForTimeout(300);
    const path = join(dir, `${id}.png`);
    await page.screenshot({ path });
    console.log(path);
  }
  await context.close();
}, `${dir}: one shot per profile`);
