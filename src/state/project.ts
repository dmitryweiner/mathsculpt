// Модель в браузере — запись кита (`core/storage`): модель, открытый пресет
// и данное файлу имя переживают перезагрузку. Нужна PWA: новая версия
// приходит перезагрузкой открытой страницы, и работа не должна теряться.
// Пишется после каждой законченной правки, отмены, смены пресета или имени;
// сбой записи приложение показывает баннером кита. Что хранилище вернуло —
// чистится; мусор, чужая или более новая версия — пустой старт.

import type { PresetRef } from 'maker-kit/core/presets';
import { isPresetRef, PRESET_NAME_CHARS } from 'maker-kit/core/presets';
import type { StoredRecord } from 'maker-kit/core/storage';
import type { AppState } from './schema';
import { cleanState } from './schema';

/** Свой ключ на общем для всех приложений origin `<user>.github.io`. */
export const PROJECT_KEY = 'mathsculpt_project';

export interface StoredProject {
  state: AppState;
  /** открытый пресет: имя на кнопке и ● после перезагрузки те же */
  ref: PresetRef;
  /** имя, данное файлу проекта */
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
