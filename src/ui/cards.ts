// Карточки формул: чекбокс, тег, описание, слайдеры с +/- и селекты.
// Свёрнуты по умолчанию; включение чекбокса разворачивает.
// Карточка правит CardState на месте и зовёт onChange.

import type { CardDef } from '../formulas';
import type { CardState } from '../geo/build';
import { make } from './dom';

export interface CardHandles {
  root: HTMLElement;
  /** синхронизировать контролы из state (после загрузки пресета) */
  sync(): void;
}

export function buildCard(def: CardDef, state: CardState, onChange: () => void): CardHandles {
  const root = make('div', 'fcard');
  root.id = `card_${def.id}`;

  const head = make('div', 'fcard-head');
  const enable = make('input');
  enable.type = 'checkbox';
  enable.id = `en_${def.id}`;
  enable.checked = state.on;
  head.appendChild(enable);
  head.appendChild(make('span', 'fcard-title', def.title));
  head.appendChild(make('span', 'fcard-tag', def.tag));
  const caret = make('span', 'fcard-caret', '▸');
  head.appendChild(caret);
  root.appendChild(head);

  const body = make('div', 'fcard-body');
  body.appendChild(make('div', 'fcard-desc', def.desc));

  interface Bound {
    input: HTMLInputElement | HTMLSelectElement;
    out?: HTMLOutputElement;
    k: string;
  }
  const bound: Bound[] = [];

  for (const sel of def.selects ?? []) {
    const row = make('label', 'row');
    row.appendChild(make('span', '', sel.name));
    const select = make('select');
    select.id = `p_${def.id}_${sel.k}`;
    for (const o of sel.options) {
      const opt = make('option', '', o.label);
      opt.value = String(o.v);
      select.appendChild(opt);
    }
    select.value = String(state.params[sel.k] ?? sel.value);
    select.addEventListener('input', () => {
      state.params[sel.k] = Number(select.value);
      onChange();
    });
    row.appendChild(select);
    body.appendChild(row);
    bound.push({ input: select, k: sel.k });
  }

  for (const s of def.sliders) {
    const row = make('div', 'row');
    row.appendChild(make('span', '', s.name));
    const minus = make('button', 'adj-btn', '−');
    const slider = make('input');
    slider.type = 'range';
    slider.id = `p_${def.id}_${s.k}`;
    slider.min = String(s.min);
    slider.max = String(s.max);
    slider.step = String(s.step);
    slider.value = String(state.params[s.k] ?? s.value);
    const plus = make('button', 'adj-btn', '+');
    minus.dataset.slider = slider.id;
    minus.dataset.dir = '-1';
    plus.dataset.slider = slider.id;
    plus.dataset.dir = '1';
    const out = make('output');
    const show = (): void => {
      out.value = String(Number(slider.value));
    };
    slider.addEventListener('input', () => {
      state.params[s.k] = Number(slider.value);
      show();
      onChange();
    });
    show();
    row.appendChild(minus);
    row.appendChild(slider);
    row.appendChild(plus);
    row.appendChild(out);
    body.appendChild(row);
    bound.push({ input: slider, out, k: s.k });
  }

  root.appendChild(body);

  const setCollapsed = (collapsed: boolean): void => {
    root.classList.toggle('collapsed', collapsed);
    caret.textContent = collapsed ? '▸' : '▾';
  };
  setCollapsed(!state.on);

  enable.addEventListener('input', () => {
    state.on = enable.checked;
    if (state.on) setCollapsed(false);
    onChange();
  });

  head.addEventListener('click', (e) => {
    if (e.target === enable) return;
    setCollapsed(!root.classList.contains('collapsed'));
  });

  return {
    root,
    sync(): void {
      enable.checked = state.on;
      setCollapsed(!state.on);
      for (const b of bound) {
        b.input.value = String(state.params[b.k]);
        if (b.out) b.out.value = String(Number(b.input.value));
      }
    },
  };
}
