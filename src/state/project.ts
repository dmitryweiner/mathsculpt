// The model in the browser — the kit's record (`core/storage`): the model,
// the open preset and the file's given name survive a reload. The PWA needs
// it: a new version arrives by reloading the open page, and the work must
// not be lost. Written after every finished edit, undo, change of preset or
// name; a failed write is the kit's banner. What storage returns is
// cleaned; garbage, another or a newer version — a fresh start.

import type { PresetRef } from 'maker-kit/core/presets';
import { isPresetRef, PRESET_NAME_CHARS } from 'maker-kit/core/presets';
import type { StoredRecord } from 'maker-kit/core/storage';
import type { AppState } from './schema';
import { cleanState } from './schema';

/** A key of its own on the `<user>.github.io` origin every app shares. */
export const PROJECT_KEY = 'mathsculpt_project';

export interface StoredProject {
  state: AppState;
  /** the open preset: the name on the button and ● stay the same after a reload */
  ref: PresetRef;
  /** the name given to the project file */
  name: string;
}

export const projectRecord: StoredRecord<StoredProject> = {
  key: PROJECT_KEY,
  version: 1,
  write: ({ state, ref, name }) => ({ state, ref, name }),
  read(data, version) {
    if (version !== 1 || typeof data !== 'object' || data === null) return null;
    const state: unknown = Reflect.get(data, 'state');
    if (typeof state !== 'object' || state === null) return null;
    const ref: unknown = Reflect.get(data, 'ref');
    const name: unknown = Reflect.get(data, 'name');
    return {
      state: cleanState(state),
      ref: isPresetRef(ref) ? ref : '',
      name: typeof name === 'string' ? name.slice(0, PRESET_NAME_CHARS) : '',
    };
  },
};
