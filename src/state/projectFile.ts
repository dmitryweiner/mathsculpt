// The model as a file — the kit's wrapper (`core/projectFile`): `{ app:
// 'mathsculpt', version: 1, name, savedAt, state }`, indented JSON — kept
// next to the STL, mailed, opened on another machine. The file comes from
// outside: reading never throws, a foreign or broken file is a refusal with
// its reason (`kit.file.*`), never defaults over the work; the state is
// cleaned.

import type { DecodedProjectFile } from 'maker-kit/core/projectFile';
import { decodeProjectFile, encodeProjectFile, projectFileName } from 'maker-kit/core/projectFile';
import type { AppState } from './schema';
import { cleanState } from './schema';

const APP = 'mathsculpt';
const VERSION = 1;

export function encodeProject(name: string, state: AppState, savedAt?: Date): string {
  return encodeProjectFile({ app: APP, version: VERSION, name, state, savedAt });
}

export function decodeProject(text: string): DecodedProjectFile<AppState> {
  return decodeProjectFile(text, { app: APP, version: VERSION, sanitize: cleanState });
}

/** `classic-vase.mathsculpt.json`: letters of any script; with no name — `model`. */
export function projectFile(name: string): string {
  return projectFileName(name, 'mathsculpt.json', 'model');
}
