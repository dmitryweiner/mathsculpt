// Язык интерфейса: словари, выбор языка, шаблоны — и сторож от
// непереведённого текста: первая строка, написанная мимо словаря, тихо
// осталась бы английской в русском интерфейсе; здесь она ловится.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { kitMessages } from 'maker-kit/i18n/index';
import { stlFileName } from 'maker-kit/3d/stl';
import { DICTS, LANGS, PLURAL_ORDER, detectLang, direction, format, hasKey, placeholders } from '../src/i18n';
import { PRESETS } from '../src/state/presets';

const KEYS = Object.keys(DICTS.en).filter(hasKey);
const FOREIGN = /[А-Яа-яЁёЇїІіЄєҐґ֐-׿]/;

describe('словари', () => {
  it('в каждом языке ровно ключи английского', () => {
    for (const lang of LANGS) expect(Object.keys(DICTS[lang]).toSorted(), lang).toEqual(KEYS.toSorted());
  });

  it('строки кита — как у кита', () => {
    for (const lang of LANGS) {
      for (const [key, text] of Object.entries(kitMessages[lang])) expect(Reflect.get(DICTS[lang], key), `${lang}:${key}`).toBe(text);
    }
  });

  it('пустых строк нет', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) expect(DICTS[lang][key].trim().length, `${lang}:${key}`).toBeGreaterThan(0);
    }
  });

  it('в английском нет кириллицы и иврита', () => {
    for (const key of KEYS) expect(DICTS.en[key], key).not.toMatch(FOREIGN);
  });

  it('переведено: русский, украинский и иврит не повторяют английский там, где в нём есть слова', () => {
    // формулы, обозначения и имена собственные одинаковы во всех языках
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

  it('в одном слове не смешаны латиница и кириллица (латинская «e» в русском слове)', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        for (const word of DICTS[lang][key].split(/[^\p{L}]+/u)) {
          expect(/[A-Za-z]/.test(word) && /[А-Яа-яЁёЇїІіЄєҐґ]/.test(word), `${lang}:${key}: ${word}`).toBe(false);
        }
      }
    }
  });

  it('в каждом языке те же параметры шаблонов', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect([...new Set(placeholders(DICTS[lang][key]))], `${lang}:${key}`).toEqual([...new Set(placeholders(DICTS.en[key]))]);
      }
    }
  });

  it('формы множественного: столько, сколько у языка категорий для целых', () => {
    const forms = (template: string): number[] =>
      [...template.matchAll(/\{\w+\|([^}]*)\}/g)].map((match) => (match[1] ?? '').split('|').length);
    for (const lang of LANGS) {
      for (const key of KEYS) {
        for (const count of forms(DICTS[lang][key])) expect(count, `${lang}:${key}`).toBe(PLURAL_ORDER[lang].length);
      }
    }
  });

  it('имена встроенных пресетов различны в каждом языке, и из любого выходит имя файла', () => {
    for (const lang of LANGS) {
      const names = PRESETS.map((preset) => Reflect.get(DICTS[lang], `preset.${preset.id}.name`));
      expect(new Set(names).size, lang).toBe(PRESETS.length);
      for (const name of names) expect(stlFileName(String(name), 'model'), `${lang}:${String(name)}`).not.toBe('model.stl');
    }
  });
});

describe('detectLang', () => {
  it('первый поддержанный язык браузера, иначе английский', () => {
    expect(detectLang(['ru-RU', 'en-US'], null)).toBe('ru');
    expect(detectLang(['uk-UA'], null)).toBe('uk');
    expect(detectLang(['he-IL'], null)).toBe('he');
    expect(detectLang(['iw'], null)).toBe('he');
    expect(detectLang(['de-DE', 'uk', 'en'], null)).toBe('uk');
    expect(detectLang(['be', 'kk'], null)).toBe('en');
    expect(detectLang([], null)).toBe('en');
  });

  it('сохранённый выбор важнее браузера, мусор в хранилище — нет', () => {
    expect(detectLang(['ru-RU'], 'he')).toBe('he');
    expect(detectLang(['ru-RU'], 'klingon')).toBe('ru');
    expect(detectLang(['en-US'], 42)).toBe('en');
  });
});

describe('direction', () => {
  it('иврит справа налево, остальные слева направо', () => {
    expect(direction('he')).toBe('rtl');
    for (const lang of ['en', 'ru', 'uk'] as const) expect(direction(lang), lang).toBe('ltr');
  });
});

describe('format', () => {
  it('подставляет параметры', () => {
    expect(format('{k}k triangles · {ms} ms', { k: '18.6', ms: 10 }, 'en')).toBe('18.6k triangles · 10 ms');
  });
});

describe('сторож: видимый текст только через словари', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }
  const sources = files('src').filter((path) => /\.(ts|css)$/.test(path) && !path.startsWith(join('src', 'i18n')));

  it('в строковых литералах вне src/i18n нет кириллицы и иврита', () => {
    for (const path of sources) {
      // комментарии — по-русски, и это не текст интерфейса
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const match of code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        expect(match[2], `${path}: ${match[0]}`).not.toMatch(FOREIGN);
      }
    }
  });

  it('в index.html текст — английский запасной (его видно до скрипта)', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(FOREIGN);
  });
});
