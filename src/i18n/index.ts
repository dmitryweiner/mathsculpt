// Interface language. A tiny binding instead of a library: tsc checks the
// keys (`Key` comes from the English reference dictionary); templates are
// maker-kit's core/format. English only for now: the other languages, their
// detection and the switch come with m5-i18n (plans/PLAN-MAKER-KIT.md).

import { format } from 'maker-kit/core/format';
import type { Message, Params, Translate } from 'maker-kit/core/message';
import { en } from './en';

export type Key = keyof typeof en;
export type { Params };

export function t(key: Key, params?: Params): string {
  return format(en[key], params, 'en');
}

/** The kit's translate function: its components take it. */
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

/**
 * The prefixes of auto preset names in every language: the numbering is
 * shared whatever language was on when they were saved.
 */
export function autoPresetPrefixes(): string[] {
  return [en['presets.auto']];
}
