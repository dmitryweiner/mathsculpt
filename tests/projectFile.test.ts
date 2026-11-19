// The project file is the kit's wrapper `{ app: 'mathsculpt', version: 1,
// name, savedAt, state }`. The file comes from outside: reading never
// throws, a foreign or broken file is a refusal with its reason, the state
// from a file is cleaned.
import { decodeProject, encodeProject, projectFile } from '../src/state/projectFile';
import { defaultState } from '../src/state/schema';
import { PRESETS } from '../src/state/presets';

const SAVED = new Date('2026-11-19T10:00:00Z');

describe('the project file', () => {
  it('a round trip: the name and the state', () => {
    const state = PRESETS.find((p) => p.id === 'gyroid-sphere')?.build() ?? defaultState();
    const decoded = decodeProject(encodeProject('My sphere', state, SAVED));
    expect(decoded).toEqual({ ok: true, name: 'My sphere', state });
  });

  it('the kit wrapper with the app id', () => {
    expect(JSON.parse(encodeProject('x', defaultState(), SAVED))).toMatchObject({
      app: 'mathsculpt',
      version: 1,
      name: 'x',
      savedAt: '2026-11-19T10:00:00.000Z',
    });
  });

  it('the state from a file is cleaned: a height past the limit is clamped, foreign keys go', () => {
    const text = JSON.stringify({ app: 'mathsculpt', version: 1, name: 'n', state: { ...defaultState(), heightMm: 9999, junk: 1 } });
    const decoded = decodeProject(text);
    expect(decoded.ok && decoded.state.heightMm).toBe(400);
    expect(decoded.ok && Object.hasOwn(decoded.state, 'junk')).toBe(false);
  });

  it('refusals with their reason', () => {
    expect(decodeProject('{oops')).toEqual({ ok: false, reason: 'broken' });
    expect(decodeProject(JSON.stringify({ app: 'clayform', version: 1, state: {} }))).toEqual({ ok: false, reason: 'foreign' });
    expect(decodeProject(JSON.stringify({ profile: 'vase' }))).toEqual({ ok: false, reason: 'foreign' });
    expect(decodeProject(JSON.stringify({ app: 'mathsculpt', version: 2, state: {} }))).toEqual({ ok: false, reason: 'newer' });
  });

  it('the file name: letters of any script, a fallback with no name', () => {
    expect(projectFile('Classic vase')).toBe('classic-vase.mathsculpt.json');
    expect(projectFile('Классическая ваза')).toBe('классическая-ваза.mathsculpt.json');
    expect(projectFile('  ')).toBe('model.mathsculpt.json');
  });
});
