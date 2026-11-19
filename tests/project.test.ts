// Модель в браузере — запись кита `mathsculpt_project`: модель, открытый
// пресет и данное имя переживают перезагрузку (PWA обновляется ею). Что
// хранилище вернуло — чистится; мусор — пустой старт, а не исключение.
import { loadRecord, saveRecord } from 'maker-kit/core/storage';
import type { KeyValueStorage } from 'maker-kit/core/storage';
import { PROJECT_KEY, projectRecord } from '../src/state/project';
import { defaultState } from '../src/state/schema';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('модель в браузере', () => {
  it('ключ свой на общем origin github.io', () => {
    expect(PROJECT_KEY).toBe('mathsculpt_project');
  });

  it('туда и обратно: модель, открытый пресет, данное имя', () => {
    const storage = memoryStorage();
    const project = { state: { ...defaultState(), profile: 'torus', heightMm: 90 }, ref: 'b:pixel-torus' as const, name: 'Donut' };
    expect(saveRecord(storage, projectRecord, project)).toBe('ok');
    expect(JSON.parse(storage.data[PROJECT_KEY] ?? '{}')).toMatchObject({ version: 1, ref: 'b:pixel-torus', name: 'Donut' });
    expect(loadRecord(storage, projectRecord)).toEqual(project);
  });

  it('состояние чистится, чужая ссылка на пресет и не строка-имя — пустые', () => {
    const storage = memoryStorage({
      [PROJECT_KEY]: JSON.stringify({ version: 1, state: { ...defaultState(), heightMm: 9999 }, ref: 'x:y', name: 42 }),
    });
    const project = loadRecord(storage, projectRecord);
    expect(project?.state.heightMm).toBe(400);
    expect(project?.ref).toBe('');
    expect(project?.name).toBe('');
  });

  it('мусор — пустой старт', () => {
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{oops' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{"version":1,"state":7}' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{"version":2,"state":{}}' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage(), projectRecord)).toBeNull();
  });
});
