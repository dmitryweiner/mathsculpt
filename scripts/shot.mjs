#!/usr/bin/env node
// Скриншоты превью: по одному на каждый профиль → ./shots
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}

let devProc = null;
if (!(await serverUp())) {
  devProc = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
}

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
await page.goto(BASE);
await page.waitForTimeout(600);

const ids = await page.$$eval('#profile option', (els) => els.map((e) => e.value));
for (const id of ids) {
  await page.selectOption('#profile', id);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/${id}.png` });
  console.log(`shots/${id}.png`);
}

await browser.close();
devProc?.kill();
