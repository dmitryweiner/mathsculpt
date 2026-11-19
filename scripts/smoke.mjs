#!/usr/bin/env node
// Браузерный смоук: то, что нельзя проверить в vitest — Three.js/WebGL,
// воркер, реальные клики по панели, выгрузка файла.
//
//   node scripts/smoke.mjs                    # dev-сервер (:5287)
//   node scripts/smoke.mjs --preview          # прод-сборка (пересобирается, vite preview :4287)
//   node scripts/smoke.mjs --shots shots      # + кадр в конце каждого шага
//
// Шаги — китовой обвязки (`app.step`): каждый в свежей странице и чистом
// хранилище, ошибки консоли помечены шагом. Любая ошибка консоли/страницы
// или упавший шаг → ненулевой код выхода (годится для CI); провал оставляет
// кадр `smoke-fail.png` (в --shots или во временной папке). Браузер — в
// en-US: проверки читают английский текст; языки проверяет свой шаг.

import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { binaryStl, check, download, horizontalOverflow, launch, parseArgs, settled, VIEWPORTS } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2), ['shots']);
const shotsDir = flags.get('shots');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const app = await launch({ preview: flags.has('preview') });
let shotNumber = 0;

/**
 * Шаг в свежей странице: `fn(page)`; с --shots — кадр в конце, при провале —
 * всегда (`smoke-fail.png`).
 */
async function step(name, fn, open = {}) {
  await app.step(name, async () => {
    const { page, context } = await app.open({ viewport: VIEWPORTS.desktop, locale: 'en-US', ...open });
    try {
      await page.waitForSelector('#status[data-build]');
      await fn(page);
      shotNumber++;
      if (shotsDir)
        await page.screenshot({ path: join(shotsDir, `${String(shotNumber).padStart(2, '0')}-${name.replace(/\W+/g, '-')}.png`) });
    } catch (error) {
      const shot = join(shotsDir ?? tmpdir(), 'smoke-fail.png');
      await page.screenshot({ path: shot }).catch(() => {});
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nframe: ${shot}`, { cause: error });
    } finally {
      await context.close();
    }
  });
}

const statusOf = (page) => page.locator('#status').textContent();

async function expectWatertight(page, what) {
  const status = await statusOf(page);
  check(status.includes('watertight ✓'), `${what}: status "${status}"`);
}

/** Раскрывает свёрнутую карточку, где лежит контрол: в свёрнутой его не видно. */
async function reveal(page, id) {
  await page.evaluate((target) => {
    const card = document.getElementById(target)?.closest('.fcard.collapsed');
    card?.querySelector(':scope > .fcard-head')?.click();
  }, id);
}

/** Ползунок как отпущенный: кадр (input) и законченная правка (change) — шаг отмены. */
async function setSlider(page, id, value) {
  await reveal(page, id);
  const slider = page.locator(`#${id}`);
  await slider.fill(value);
  await slider.dispatchEvent('input');
  await slider.dispatchEvent('change');
}

/** Высота модели в STL, мм: размах z по вершинам двоичного файла. */
function stlHeight(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  let min = Infinity;
  let max = -Infinity;
  for (let t = 0; t < count; t++) {
    for (let v = 0; v < 3; v++) {
      const z = view.getFloat32(84 + t * 50 + 12 + v * 12 + 8, true);
      min = Math.min(min, z);
      max = Math.max(max, z);
    }
  }
  return max - min;
}

await app.run(
  async () => {
    await step('every profile builds watertight', async (page) => {
      const ids = await page.$$eval('#shape_profile option', (els) => els.map((e) => e.value));
      check(ids.length >= 17, `only ${ids.length} profiles`);
      for (const id of ids) {
        await page.selectOption('#shape_profile', id);
        await page.waitForTimeout(250);
        await expectWatertight(page, `profile ${id}`);
      }
    });

    // галочка — первой строкой внутри карточки (#p_<карточка>_on)
    await step('every card switches on and off', async (page) => {
      const cardIds = await page.$$eval('#displaceCards .fcard, #deformCards .fcard', (els) => els.map((e) => e.id.replace('card_', '')));
      check(cardIds.length >= 30, `only ${cardIds.length} cards`);
      for (const id of cardIds) {
        await reveal(page, `p_${id}_on`);
        await page.locator(`#p_${id}_on`).click();
        await page.waitForTimeout(150);
        await expectWatertight(page, `card ${id}`);
        await page.locator(`#p_${id}_on`).click();
        await page.waitForTimeout(80);
      }
    });

    // из диалога кита; имя открытого — на кнопке пресетов
    await step('every built-in preset opens from the dialog', async (page) => {
      await page.locator('#presetBtn').click();
      const refs = await page.$$eval('#presetList .preset-row[data-ref^="b:"]', (els) => els.map((e) => e.dataset.ref));
      await page.locator('#presetsClose').click();
      check(refs.length >= 20, `only ${refs.length} presets`);
      for (const ref of refs) {
        await page.locator('#presetBtn').click();
        const pick = page.locator(`#presetList .preset-row[data-ref="${ref}"] .preset-pick`);
        const name = await pick.locator('.preset-name').textContent();
        await pick.click();
        await page.waitForTimeout(300);
        await expectWatertight(page, `preset ${ref}`);
        const button = (await page.locator('#presetBtn').textContent()).trim();
        check(button === name, `preset ${ref}: the button says "${button}"`);
      }
    });

    await step('undo and redo a slider: one step', async (page) => {
      const amp = page.locator('#p_ripples_amp');
      const before = await amp.inputValue();
      await setSlider(page, 'p_ripples_amp', '0.08');
      await page.locator('#undoBtn').click();
      await page.waitForTimeout(150);
      check((await amp.inputValue()) === before, `undo: amp=${await amp.inputValue()}, expected ${before}`);
      await page.locator('#redoBtn').click();
      await page.waitForTimeout(150);
      check((await amp.inputValue()) === '0.08', `redo: amp=${await amp.inputValue()}, expected 0.08`);
      check(await page.locator('#redoBtn').isDisabled(), 'redo is still enabled at the newest step');
    });

    // 📄 Новое: модель по умолчанию под именем «New model»; ↶ возвращает прежнюю
    await step('📄 New opens the default model, one undo step', async (page) => {
      await page.locator('#presetBtn').click();
      await page.locator('#presetList .preset-row[data-ref="b:gyroid-sphere"] .preset-pick').click();
      await page.waitForTimeout(300);
      check((await page.locator('#shape_profile').inputValue()) === 'sphere', 'the gyroid sphere did not open');
      await page.locator('#newBtn').click();
      await page.waitForTimeout(300);
      check(
        (await page.locator('#presetBtn').textContent()).trim() === 'New model',
        `the button says "${await page.locator('#presetBtn').textContent()}"`,
      );
      check((await page.locator('#shape_profile').inputValue()) === 'vase', 'not the default model');
      await expectWatertight(page, 'new');
      await page.locator('#undoBtn').click();
      await page.waitForTimeout(300);
      check((await page.locator('#shape_profile').inputValue()) === 'sphere', 'undo did not bring the sphere back');
    });

    // 💾: пресет под именем из prompt — в «My presets», и после перезагрузки тоже
    await step('a saved preset survives a reload', async (page) => {
      page.once('dialog', (dialog) => dialog.accept('Smoke preset'));
      await page.locator('#saveBtn').click();
      await page.waitForTimeout(200);
      await page.reload();
      await page.waitForTimeout(400);
      await page.locator('#presetBtn').click();
      const mine = await page.$$eval('#presetList .preset-row[data-ref^="u:"] input', (els) => els.map((e) => e.value));
      check(mine.includes('Smoke preset'), `my presets: ${JSON.stringify(mine)}`);
    });

    // открытый верх: wall=0 → оболочка, wall>0 → watertight-солид
    await step('open top: a shell, then a hollow vessel with a wall', async (page) => {
      await page.selectOption('#shape_caps', 'bottom');
      await page.waitForTimeout(200);
      check(await page.locator('#shape_wall').isVisible(), 'the wall row is hidden in open top');
      await setSlider(page, 'shape_wall', '0');
      await page.waitForTimeout(300);
      const shell = await statusOf(page);
      check(shell.includes('open top'), `wall 0: status "${shell}" (a shell expected)`);
      await setSlider(page, 'shape_wall', '3');
      await page.waitForTimeout(300);
      await expectWatertight(page, 'wall 3');
      await page.selectOption('#shape_caps', 'both');
      await page.waitForTimeout(200);
      check(await page.locator('#shape_wall').isHidden(), 'the wall row is shown in solid mode');
    });

    // полная сборка в воркере: статус со временем показывает «full N×N»
    await step('the worker builds the full mesh', async (page) => {
      await page.waitForSelector('#status[data-build="full"]', { timeout: 15000 });
      await expectWatertight(page, 'full build');
    });

    // настройка формы видна у пресет-профиля и скрыта у Фурье; Фурье — своя карточка
    await step('the profile shape and Fourier cards', async (page) => {
      await page.selectOption('#shape_profile', 'vase');
      await page.waitForTimeout(250);
      check(await page.locator('#card_profileShape').isVisible(), 'the profile shape card is hidden for a preset profile');
      await setSlider(page, 'p_profileShape_belly', '0.6');
      await page.waitForTimeout(250);
      await expectWatertight(page, 'belly 0.6');
      await page.selectOption('#shape_profile', 'fourier');
      await page.waitForTimeout(300);
      check(await page.locator('#card_fourier').isVisible(), 'the Fourier card is hidden');
      check(await page.locator('#card_profileShape').isHidden(), 'the profile shape card is still shown');
      await expectWatertight(page, 'fourier');
    });

    await step('modulation: a route and its ∿', async (page) => {
      await page.locator('#card_mod .fcard-head').click();
      await page.waitForTimeout(150);
      await page.locator('#addRouteBtn').click();
      await page.waitForTimeout(300);
      check((await page.locator('.mod-badge').count()) >= 1, 'no ∿ badge after adding a route');
      await expectWatertight(page, 'with a route');
    });

    // настоящий файл: двоичный STL, треугольники есть, высота — заданные мм
    await step('downloads a real STL in millimetres', async (page) => {
      await setSlider(page, 'shape_height', '150');
      await page.waitForTimeout(300);
      const file = await download(page, '#exportBtn');
      const stl = binaryStl(file.bytes);
      check(file.name === 'vase.stl' && stl !== null && stl.triangles > 0, `broken STL: ${file.name}, ${file.bytes.length} bytes`);
      check(stl.header.startsWith('MathSculpt'), `STL header "${stl.header}"`);
      const height = stlHeight(file.bytes);
      check(Math.abs(height - 150) < 0.01, `the STL is ${height} mm tall, 150 expected`);
    });

    // браузер на русском открывает русский; 🌐 переключает, выбор переживает
    // перезагрузку; иврит зеркалит страницу (панель справа)
    await step(
      'languages: Russian by the browser, Hebrew mirrored, the choice kept',
      async (page) => {
        check(
          (await page.locator('html').getAttribute('lang')) === 'ru',
          `ru-RU browser: lang=${await page.locator('html').getAttribute('lang')}`,
        );
        check((await page.locator('#exportBtn').textContent()).trim() === 'Выгрузить STL', 'ru: the export button is not in Russian');
        check((await page.locator('label[for="p_ripples_amp"]').textContent()) === 'Амплитуда', 'ru: the panel is not in Russian');
        await page.selectOption('.lang-field select', 'he');
        await page.waitForTimeout(300);
        check((await page.locator('html').getAttribute('dir')) === 'rtl', 'he: the page is not right to left');
        const box = await page.locator('#panel').boundingBox();
        check(box && box.x > VIEWPORTS.desktop.width / 2, `he: the panel is not on the right (x=${box?.x})`);
        await page.reload();
        await page.waitForFunction(() => document.documentElement.lang === 'he');
      },
      { locale: 'ru-RU' },
    );

    // широкий экран: панель рядом с видом, ничего не уезжает вбок
    await step('desktop: no sideways scroll', async (page) => {
      check((await horizontalOverflow(page)) === 0, `the page scrolls sideways by ${await horizontalOverflow(page)} px`);
    });

    // телефон: панель — нижний лист кита; ручка закрывает, «Settings» открывает
    await step(
      'phone: the sheet closes and opens, no sideways scroll',
      async (page) => {
        await settled(page);
        await page.locator('#sheetClose').click();
        await settled(page);
        check(!(await page.locator('#panel').evaluate((node) => node.classList.contains('open'))), 'the sheet did not close');
        await page.locator('#sheetOpen').click();
        await settled(page);
        check((await page.locator('#sheetOpen').getAttribute('aria-expanded')) === 'true', 'the sheet did not open');
        check((await horizontalOverflow(page)) === 0, `the page scrolls sideways by ${await horizontalOverflow(page)} px`);
      },
      { viewport: VIEWPORTS.phone },
    );
  },
  `smoke passed (${flags.has('preview') ? 'preview' : 'dev'})`,
);
