// Пользовательские пресеты в localStorage — запись кита (`core/storage`).
// Чтение никогда не бросает: хранилище может быть недоступно (приватный
// режим) или хранить мусор прошлых версий — приложение обязано открыться в
// любом случае. Неудачная запись говорит почему (`StorageWrite`), и
// приложение это показывает.
//
// Ключ — прежний. До кита пресеты лежали голым списком `{ name, state }` и
// узнавались по имени: кит читает его как версию 0 и раздаёт id `u<n>`,
// которые потом не меняются при переименовании.

import type { StoredRecord } from 'maker-kit/core/storage';
import type { UserPreset } from 'maker-kit/core/presets';
import { addUserPreset, readUserPresets } from 'maker-kit/core/presets';
import type { AppState } from './schema';
import { cleanState } from './schema';

export const USER_PRESETS_KEY = 'mathsculpt_user_presets_v1';

export type SculptPreset = UserPreset<AppState>;

export const userPresetsRecord: StoredRecord<SculptPreset[]> = {
  key: USER_PRESETS_KEY,
  version: 1,
  write: (presets) => ({ presets }),
  read: (data, version) =>
    readUserPresets(version === 0 ? data : typeof data === 'object' && data !== null ? Reflect.get(data, 'presets') : null, cleanState),
};

/**
 * 💾 под именем: занятое имя заменяет тот пресет — его id и место в списке
 * остаются, как было до кита, когда пресет и был своим именем.
 */
export function savePresetAs(list: readonly SculptPreset[], name: string, state: AppState): { list: SculptPreset[]; id: string } {
  const same = list.find((preset) => preset.name === name);
  if (!same) return addUserPreset(list, name, state);
  return { list: list.map((preset) => (preset === same ? { ...preset, state } : preset)), id: same.id };
}
