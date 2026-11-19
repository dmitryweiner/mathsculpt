// The interface language: the dictionaries, the choice of language, the
// templates — and the guard against untranslated text: the first line
// written past the dictionary would quietly stay English in the Russian
// interface; it is caught here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { kitMessages } from 'maker-kit/i18n/index';
import { stlFileName } from 'maker-kit/3d/stl';
import { DICTS, LANGS, PLURAL_ORDER, detectLang, direction, format, hasKey, placeholders } from '../src/i18n';
import { PRESETS } from '../src/state/presets';

const KEYS = Object.keys(DICTS.en).filter(hasKey);
const FOREIGN = /[А-Яа-яЁёЇїІіЄєҐґ֐-׿]/;

describe('dictionaries', () => {
  it('every language has exactly the keys of English', () => {
    for (const lang of LANGS) expect(Object.keys(DICTS[lang]).toSorted(), lang).toEqual(KEYS.toSorted());
  });

  it('the kit strings are as the kit has them', () => {
    for (const lang of LANGS) {
      for (const [key, text] of Object.entries(kitMessages[lang])) expect(Reflect.get(DICTS[lang], key), `${lang}:${key}`).toBe(text);
    }
  });

  it('no empty strings', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) expect(DICTS[lang][key].trim().length, `${lang}:${key}`).toBeGreaterThan(0);
    }
  });

  it('English has no Cyrillic or Hebrew', () => {
    for (const key of KEYS) expect(DICTS.en[key], key).not.toMatch(FOREIGN);
  });

  it('translated: Russian, Ukrainian and Hebrew do not repeat English where it has words', () => {
    // formulas, notation and proper names are the same in every language
    const same = new Set([
      'lfo.shape.random',
      'mod.route.src',
      'unit.mm',
      'status.full',
      'lfo.title',
      'card.torus.desc',
      'card.fourier.desc',
    ]);
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      for (const key of KEYS) {
        if (key.startsWith('kit.') || same.has(key) || !/[A-Za-z]{3,}/.test(DICTS.en[key])) continue;
        expect(DICTS[lang][key], `${lang}:${key}`).not.toBe(DICTS.en[key]);
      }
    }
  });

  it('no word mixes Latin and Cyrillic (a Latin "e" in a Russian word)', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        for (const word of DICTS[lang][key].split(/[^\p{L}]+/u)) {
          expect(/[A-Za-z]/.test(word) && /[А-Яа-яЁёЇїІіЄєҐґ]/.test(word), `${lang}:${key}: ${word}`).toBe(false);
        }
      }
    }
  });

  it('every language uses the same template parameters', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect([...new Set(placeholders(DICTS[lang][key]))], `${lang}:${key}`).toEqual([...new Set(placeholders(DICTS.en[key]))]);
      }
    }
  });

  it('plural forms: as many as the language has categories for whole numbers', () => {
    const forms = (template: string): number[] =>
      [...template.matchAll(/\{\w+\|([^}]*)\}/g)].map((match) => (match[1] ?? '').split('|').length);
    for (const lang of LANGS) {
      for (const key of KEYS) {
        for (const count of forms(DICTS[lang][key])) expect(count, `${lang}:${key}`).toBe(PLURAL_ORDER[lang].length);
      }
    }
  });

  it('built-in preset names are distinct in every language, and each makes a file name', () => {
    for (const lang of LANGS) {
      const names = PRESETS.map((preset) => Reflect.get(DICTS[lang], `preset.${preset.id}.name`));
      expect(new Set(names).size, lang).toBe(PRESETS.length);
      for (const name of names) expect(stlFileName(String(name), 'model'), `${lang}:${String(name)}`).not.toBe('model.stl');
    }
  });
});

describe('detectLang', () => {
  it('the first supported language of the browser, English otherwise', () => {
    expect(detectLang(['ru-RU', 'en-US'], null)).toBe('ru');
    expect(detectLang(['uk-UA'], null)).toBe('uk');
    expect(detectLang(['he-IL'], null)).toBe('he');
    expect(detectLang(['iw'], null)).toBe('he');
    expect(detectLang(['de-DE', 'uk', 'en'], null)).toBe('uk');
    expect(detectLang(['be', 'kk'], null)).toBe('en');
    expect(detectLang([], null)).toBe('en');
  });

  it('a stored choice beats the browser, garbage in storage does not', () => {
    expect(detectLang(['ru-RU'], 'he')).toBe('he');
    expect(detectLang(['ru-RU'], 'klingon')).toBe('ru');
    expect(detectLang(['en-US'], 42)).toBe('en');
  });
});

describe('direction', () => {
  it('Hebrew runs right to left, the rest left to right', () => {
    expect(direction('he')).toBe('rtl');
    for (const lang of ['en', 'ru', 'uk'] as const) expect(direction(lang), lang).toBe('ltr');
  });
});

describe('format', () => {
  it('substitutes parameters', () => {
    expect(format('{k}k triangles · {ms} ms', { k: '18.6', ms: 10 }, 'en')).toBe('18.6k triangles · 10 ms');
  });
});

describe('guard: visible text only through the dictionaries', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }
  const sources = files('src').filter((path) => /\.(ts|css)$/.test(path) && !path.startsWith(join('src', 'i18n')));

  it('no Cyrillic or Hebrew in string literals outside src/i18n', () => {
    for (const path of sources) {
      // comments are not interface text (an example of a Cyrillic file name may be in one)
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const match of code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        expect(match[2], `${path}: ${match[0]}`).not.toMatch(FOREIGN);
      }
    }
  });

  it('index.html holds the English fallback text (seen before the script runs)', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(FOREIGN);
  });
});
