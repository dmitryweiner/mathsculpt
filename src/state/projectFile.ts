// Модель файлом — обёртка кита (`core/projectFile`): `{ app: 'mathsculpt',
// version: 1, name, savedAt, state }`, JSON с отступами — лежит рядом с
// STL, пересылается, открывается на другой машине. Файл приходит извне:
// чтение не бросает, чужой или битый файл — отказ с причиной
// (`kit.file.*`), а не дефолты поверх работы; состояние чистится.

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

/** `classic-vase.mathsculpt.json`: буквы любого письма; без имени — `model`. */
export function projectFile(name: string): string {
  return projectFileName(name, 'mathsculpt.json', 'model');
}
