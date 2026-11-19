// Interface language. A tiny binding instead of a library: tsc checks the
// keys (`Key` comes from the English reference dictionary, the others must
// repeat it key for key); templates are maker-kit's core/format.
//
// Template: `{name}` substitutes a parameter; `{n|form|form…}` picks a word
// by the number n, the forms in the order of the language's plural
// categories (PLURAL_ORDER).
//
// The language lives here, not in AppState: it never goes into a preset —
// whoever opens someone else's preset sees it in their own language.

import { format } from 'maker-kit/core/format';
import type { Message, Params, Translate } from 'maker-kit/core/message';
import { en } from './en';
import { ru } from './ru';
import { uk } from './uk';
import { he } from './he';

export type Lang = 'en' | 'ru' | 'uk' | 'he';
export const LANGS: readonly Lang[] = ['en', 'ru', 'uk', 'he'];
export type Key = keyof typeof en;
export type { Params };
export { format, placeholders } from 'maker-kit/core/format';

export const DICTS: Readonly<Record<Lang, Readonly<Record<Key, string>>>> = { en, ru, uk, he };

/** Hebrew mirrors the whole page (`dir="rtl"` on <html>); the CSS uses logical properties only. */
export function direction(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'he' ? 'rtl' : 'ltr';
}

/** localStorage key: a manual choice beats the browser settings. Unique per app on the shared origin. */
export const LANG_KEY = 'mathsculpt_lang';

/**
 * Order of the forms in `{n|…}`: the plural categories the language uses for
 * whole numbers. The kit's format reads them from Intl; this table is what
 * tests/i18n.test.ts counts forms by.
 */
export const PLURAL_ORDER: Readonly<Record<Lang, readonly Intl.LDMLPluralRule[]>> = {
  en: ['one', 'other'],
  ru: ['one', 'few', 'many'],
  uk: ['one', 'few', 'many'],
  he: ['one', 'two', 'other'],
};

let current: Lang = 'en';
const listeners = new Set<(lang: Lang) => void>();

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANGS.some((lang) => lang === value);
}

/**
 * The language from the stored choice, else from the browser: the first
 * language of the list that has a dictionary (`iw` is the old code of
 * Hebrew). Nothing found — English.
 */
export function detectLang(languages: readonly string[], stored: unknown): Lang {
  if (isLang(stored)) return stored;
  for (const tag of languages) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    const code = primary === 'iw' ? 'he' : primary;
    if (isLang(code)) return code;
  }
  return 'en';
}

/** Picks the language at startup. Storage may be unavailable — then the browser alone. */
export function initLang(): Lang {
  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  current = detectLang(languages, storedLang());
  return current;
}

function storedLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export function lang(): Lang {
  return current;
}

/** Sets the language, remembers the choice and calls the listeners. */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // private mode: the choice lives until reload
  }
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(next);
}

export function onLangChange(listener: (lang: Lang) => void): void {
  listeners.add(listener);
}

export function t(key: Key, params?: Params): string {
  return format(DICTS[current][key], params, current);
}

/** The kit's translate function: its components take it; it reads the current language at every call. */
export const tr: Translate<Key> = t;

export function hasKey(key: string): key is Key {
  return Object.hasOwn(en, key);
}

/** A key built on the fly (`preset.<id>.name`): an unknown one is shown as it is. */
export function tDynamic(key: string, params?: Params): string {
  return hasKey(key) ? t(key, params) : key;
}

/** A message of the core: a code and its parameters. */
export function tm(message: Message<Key>): string {
  return t(message.code, message.params);
}

/** The prefixes of auto preset names in every language: the numbering is shared whatever language was on. */
export function autoPresetPrefixes(): string[] {
  return LANGS.map((language) => DICTS[language]['presets.auto']);
}
