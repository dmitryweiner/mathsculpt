// @vitest-environment jsdom
// Панель на контролах кита: карточки, их строки и id (смоук и snap.mjs
// ходят по ним), включение галочкой внутри карточки, карточки носителя по
// профилю, маршруты модуляции и бейдж ∿.
import { renderPanel } from '../src/ui/panel';
import type { PanelHandle } from '../src/ui/panel';
import { defaultState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { setLang, t } from '../src/i18n';
import { restoreCards, snapshotCards } from 'maker-kit/ui/card';

interface Harness {
  panel: PanelHandle;
  changes: { state: AppState; final: boolean }[];
  get(): AppState;
}

function mount(initial: AppState = defaultState()): Harness {
  document.body.innerHTML = `
    <div id="shapeControls"></div>
    <div id="carrierCards"></div>
    <div id="displaceCards"></div>
    <div id="deformCards"></div>
    <div id="modCard"></div>`;
  const byId = (id: string): HTMLElement => {
    const node = document.getElementById(id);
    if (!node) throw new Error(id);
    return node;
  };
  let state = initial;
  const changes: Harness['changes'] = [];
  const panel = renderPanel(
    {
      shape: byId('shapeControls'),
      carriers: byId('carrierCards'),
      displace: byId('displaceCards'),
      deform: byId('deformCards'),
      mod: byId('modCard'),
    },
    {
      read: () => state,
      change: (next, final) => {
        state = next;
        changes.push({ state: next, final });
        panel.sync(state);
      },
      t,
    },
  );
  return { panel, changes, get: () => state };
}

function input(id: string): HTMLInputElement {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return node;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('панель', () => {
  it('ид строк как были: p_<карточка>_<параметр>; включение — p_<карточка>_on', () => {
    mount();
    expect(input('p_ripples_amp').type).toBe('range');
    expect(input('p_ripples_on').type).toBe('checkbox');
    expect(input('p_twist_on').checked).toBe(false);
    expect(input('p_profileShape_belly').type).toBe('range');
    expect(document.getElementById('card_ripples')).not.toBeNull();
    expect(document.getElementById('shape_profile')).toBeInstanceOf(HTMLSelectElement);
    expect(input('shape_height').value).toBe('120');
    expect(input('lfo0_rate').type).toBe('range');
  });

  it('галочка в карточке — законченная правка и разворачивает карточку', () => {
    const h = mount();
    const box = input('p_twist_on');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(h.changes.at(-1)?.final).toBe(true);
    expect(h.get().deform.twist?.on).toBe(true);
    expect(document.getElementById('card_twist')?.classList.contains('collapsed')).toBe(false);
  });

  it('ползунок: кадры жеста — live, отпущенный — final', () => {
    const h = mount();
    const amp = input('p_ripples_amp');
    amp.value = '0.05';
    amp.dispatchEvent(new Event('input'));
    expect(h.changes.at(-1)).toMatchObject({ final: false });
    amp.dispatchEvent(new Event('change'));
    expect(h.changes.at(-1)).toMatchObject({ final: true });
    expect(h.get().displace.ripples?.params.amp).toBe(0.05);
  });

  it('видна только карточка выбранного носителя', () => {
    const h = mount();
    const hidden = (id: string): boolean => document.getElementById(`card_${id}`)?.hidden === true;
    expect([hidden('profileShape'), hidden('fourier'), hidden('torus')]).toEqual([false, true, true]);
    h.panel.sync({ ...h.get(), profile: 'torus' });
    expect([hidden('profileShape'), hidden('fourier'), hidden('torus')]).toEqual([true, true, false]);
    h.panel.sync({ ...h.get(), profile: 'fourier' });
    expect([hidden('profileShape'), hidden('fourier'), hidden('torus')]).toEqual([true, false, true]);
  });

  it('маршрут: «+» добавляет, его строки и бейдж ∿ на цели, ✕ убирает', () => {
    const h = mount();
    expect(document.querySelector('.mod-badge')).toBeNull();
    document.getElementById('addRouteBtn')?.click();
    expect(h.get().mod.routes).toHaveLength(1);
    expect(h.changes.at(-1)?.final).toBe(true);
    expect(input('route0_depth').type).toBe('range');
    const [route] = h.get().mod.routes;
    const target = document.getElementById(`p_${route?.card}_${route?.param}`)?.closest('.row');
    expect(target?.querySelector('.mod-badge')).not.toBeNull();
    document.getElementById('route_0_remove')?.click();
    expect(h.get().mod.routes).toHaveLength(0);
    expect(document.getElementById('route0_depth')).toBeNull();
    expect(document.querySelector('.mod-badge')).toBeNull();
  });

  it('после смены языка панель рисуется заново на нём: карточки не двоятся, свёрнутые остаются свёрнутыми', () => {
    const h = mount();
    const hosts = ['shapeControls', 'carrierCards', 'displaceCards', 'deformCards', 'modCard'].map((id) => document.getElementById(id));
    const [shape, carriers, displace, deform, mod] = hosts;
    if (!shape || !carriers || !displace || !deform || !mod) throw new Error('hosts');
    document.querySelector<HTMLButtonElement>('#card_ripples .fcard-head')?.click();
    const folded = snapshotCards(document.body);
    try {
      setLang('ru');
      renderPanel({ shape, carriers, displace, deform, mod }, { read: () => h.get(), change: () => undefined, t });
      restoreCards(document.body, folded);
      expect(document.querySelectorAll('#card_ripples')).toHaveLength(1);
      expect(document.querySelector('label[for="p_ripples_amp"]')?.textContent).toBe('Амплитуда');
      expect(document.getElementById('card_ripples')?.classList.contains('collapsed')).toBe(true);
    } finally {
      setLang('en');
    }
  });
});
