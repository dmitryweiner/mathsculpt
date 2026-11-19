// @vitest-environment jsdom
// The static markup's texts: every data-i18n* key of index.html is in the
// dictionary, and applyStaticText puts the texts in place.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyStaticText } from '../src/ui/staticText';
import { hasKey, t } from '../src/i18n';

const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('static texts', () => {
  it('every key of the markup is in the dictionary', () => {
    const keys = [...html.matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) expect(hasKey(key), key).toBe(true);
  });

  it('applyStaticText rewrites the text, the tooltip and the aria-label', () => {
    document.body.innerHTML =
      '<button id="b" data-i18n="kit.topbar.presets" data-i18n-title="topbar.presets.title" data-i18n-aria="kit.topbar.undo">x</button>';
    applyStaticText(document);
    const button = document.getElementById('b');
    expect(button?.textContent).toBe(t('kit.topbar.presets'));
    expect(button?.title).toBe(t('topbar.presets.title'));
    expect(button?.getAttribute('aria-label')).toBe(t('kit.topbar.undo'));
    expect(document.title).toBe(t('app.title'));
  });
});
