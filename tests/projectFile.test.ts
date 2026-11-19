// Файл проекта — обёртка кита `{ app: 'mathsculpt', version: 1, name,
// savedAt, state }`. Файл приходит извне: чтение не бросает, чужой или
// битый файл — отказ с причиной, состояние из файла чистится.
import { decodeProject, encodeProject, projectFile } from '../src/state/projectFile';
import { defaultState } from '../src/state/schema';
import { PRESETS } from '../src/state/presets';

const SAVED = new Date('2026-11-19T10:00:00Z');

describe('файл проекта', () => {
  it('туда и обратно: имя и состояние', () => {
    const state = PRESETS.find((p) => p.id === 'gyroid-sphere')?.build() ?? defaultState();
    const decoded = decodeProject(encodeProject('My sphere', state, SAVED));
    expect(decoded).toEqual({ ok: true, name: 'My sphere', state });
  });

  it('обёртка кита с id приложения', () => {
    expect(JSON.parse(encodeProject('x', defaultState(), SAVED))).toMatchObject({
      app: 'mathsculpt',
      version: 1,
      name: 'x',
      savedAt: '2026-11-19T10:00:00.000Z',
    });
  });

  it('состояние из файла чистится: высота за пределом — в предел, чужие ключи уходят', () => {
    const text = JSON.stringify({ app: 'mathsculpt', version: 1, name: 'n', state: { ...defaultState(), heightMm: 9999, junk: 1 } });
    const decoded = decodeProject(text);
    expect(decoded.ok && decoded.state.heightMm).toBe(400);
    expect(decoded.ok && Object.hasOwn(decoded.state, 'junk')).toBe(false);
  });

  it('отказы с причиной', () => {
    expect(decodeProject('{oops')).toEqual({ ok: false, reason: 'broken' });
    expect(decodeProject(JSON.stringify({ app: 'clayform', version: 1, state: {} }))).toEqual({ ok: false, reason: 'foreign' });
    expect(decodeProject(JSON.stringify({ profile: 'vase' }))).toEqual({ ok: false, reason: 'foreign' });
    expect(decodeProject(JSON.stringify({ app: 'mathsculpt', version: 2, state: {} }))).toEqual({ ok: false, reason: 'newer' });
  });

  it('имя файла: буквы любого письма, запасное имя без имени', () => {
    expect(projectFile('Classic vase')).toBe('classic-vase.mathsculpt.json');
    expect(projectFile('Классическая ваза')).toBe('классическая-ваза.mathsculpt.json');
    expect(projectFile('  ')).toBe('model.mathsculpt.json');
  });
});
