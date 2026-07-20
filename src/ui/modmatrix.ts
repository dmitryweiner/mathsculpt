// Панель матрицы модуляции: пул LFO (источник/форма/rate/фаза/k) и список
// маршрутов LFO → карточка.параметр → depth. Правит ModState на месте.

import type { ModState } from '../geo/mod';
import { LFO_SHAPES, LFO_SOURCES, MOD_TARGETS } from '../geo/mod';
import { DISPLACE_CARDS, DEFORM_CARDS } from '../formulas';
import { make } from './dom';

const SOURCE_LABELS: Record<string, string> = {
  z: 'Height z',
  theta: 'Angle θ',
  spiral: 'Spiral z+k·θ',
  radius: 'Radius',
  dist: 'Distance',
};

function targetLabel(card: string, param: string): string {
  const def = [...DISPLACE_CARDS, ...DEFORM_CARDS].find((c) => c.id === card);
  const slider = def?.sliders.find((s) => s.k === param);
  return `${def?.title ?? card} · ${slider?.name ?? param}`;
}

export interface ModPanelHandles {
  root: HTMLElement;
  sync(): void;
}

export function buildModPanel(mod: ModState, onChange: () => void): ModPanelHandles {
  const root = make('div');
  root.id = 'modPanel';

  // --- LFO-пул ---
  const lfoRows: (() => void)[] = [];
  mod.lfos.forEach((lfo, idx) => {
    const box = make('div', 'fcard lfo-box');
    const head = make('div', 'lfo-head', `LFO ${idx + 1}`);
    box.appendChild(head);

    const selRow = make('div', 'row');
    const srcSel = make('select');
    srcSel.id = `lfo${idx}_source`;
    for (const s of LFO_SOURCES) {
      const opt = make('option', '', SOURCE_LABELS[s]);
      opt.value = s;
      srcSel.appendChild(opt);
    }
    const shapeSel = make('select');
    shapeSel.id = `lfo${idx}_shape`;
    for (const s of LFO_SHAPES) {
      const opt = make('option', '', s === 'random' ? 'S&H' : s);
      opt.value = s;
      shapeSel.appendChild(opt);
    }
    selRow.appendChild(srcSel);
    selRow.appendChild(shapeSel);
    box.appendChild(selRow);

    const sliders: { input: HTMLInputElement; out: HTMLOutputElement; key: 'rate' | 'phase' | 'k' }[] = [];
    const sliderRow = (
      name: string,
      key: 'rate' | 'phase' | 'k',
      min: number,
      max: number,
      step: number,
    ): void => {
      const row = make('div', 'row');
      row.appendChild(make('span', '', name));
      const input = make('input');
      input.type = 'range';
      input.id = `lfo${idx}_${key}`;
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(lfo[key]);
      const out = make('output');
      out.value = String(lfo[key]);
      input.addEventListener('input', () => {
        lfo[key] = Number(input.value);
        out.value = String(Number(input.value));
        onChange();
      });
      row.appendChild(input);
      row.appendChild(out);
      box.appendChild(row);
      sliders.push({ input, out, key });
    };
    sliderRow('Rate', 'rate', 0, 16, 0.25);
    sliderRow('Phase', 'phase', 0, 1, 0.01);
    sliderRow('Spiral k', 'k', -8, 8, 1);

    const syncKVisibility = (): void => {
      const kRow = sliders[2].input.parentElement;
      if (kRow instanceof HTMLElement) kRow.hidden = lfo.source !== 'spiral';
    };
    srcSel.addEventListener('input', () => {
      const v = srcSel.value;
      if (v === 'z' || v === 'theta' || v === 'spiral' || v === 'radius' || v === 'dist') lfo.source = v;
      syncKVisibility();
      onChange();
    });
    shapeSel.addEventListener('input', () => {
      const v = shapeSel.value;
      if (v === 'sine' || v === 'triangle' || v === 'saw' || v === 'square' || v === 'random') lfo.shape = v;
      onChange();
    });

    lfoRows.push(() => {
      srcSel.value = lfo.source;
      shapeSel.value = lfo.shape;
      for (const s of sliders) {
        s.input.value = String(lfo[s.key]);
        s.out.value = String(lfo[s.key]);
      }
      syncKVisibility();
    });
    syncKVisibility();
    root.appendChild(box);
  });

  // --- маршруты ---
  const routesBox = make('div');
  routesBox.id = 'routesBox';
  root.appendChild(routesBox);
  const addBtn = make('button', 'tb-btn', '+ Add route');
  addBtn.id = 'addRouteBtn';
  addBtn.addEventListener('click', () => {
    mod.routes.push({ src: 0, card: MOD_TARGETS[0].card, param: MOD_TARGETS[0].param, depth: 0.5 });
    renderRoutes();
    onChange();
  });
  root.appendChild(addBtn);

  function renderRoutes(): void {
    routesBox.innerHTML = '';
    mod.routes.forEach((route, idx) => {
      const row = make('div', 'fcard route-row');
      const srcSel = make('select', 'route-src');
      for (let i = 0; i < mod.lfos.length; i++) {
        const opt = make('option', '', `LFO ${i + 1}`);
        opt.value = String(i);
        srcSel.appendChild(opt);
      }
      srcSel.value = String(route.src);
      srcSel.addEventListener('input', () => {
        route.src = Number(srcSel.value);
        onChange();
      });

      const targetSel = make('select', 'route-target');
      for (const t of MOD_TARGETS) {
        const opt = make('option', '', targetLabel(t.card, t.param));
        opt.value = `${t.card}.${t.param}`;
        targetSel.appendChild(opt);
      }
      targetSel.value = `${route.card}.${route.param}`;
      targetSel.addEventListener('input', () => {
        const [card, param] = targetSel.value.split('.');
        route.card = card;
        route.param = param;
        onChange();
      });

      const depthRow = make('div', 'row');
      depthRow.appendChild(make('span', '', 'Depth'));
      const depth = make('input');
      depth.type = 'range';
      depth.id = `route${idx}_depth`;
      depth.min = '-1';
      depth.max = '1';
      depth.step = '0.01';
      depth.value = String(route.depth);
      const out = make('output');
      out.value = String(route.depth);
      depth.addEventListener('input', () => {
        route.depth = Number(depth.value);
        out.value = String(Number(depth.value));
        onChange();
      });
      const del = make('button', 'adj-btn route-del', '×');
      del.title = 'Remove route';
      del.addEventListener('click', () => {
        mod.routes.splice(idx, 1);
        renderRoutes();
        onChange();
      });

      const selRow = make('div', 'row');
      selRow.appendChild(srcSel);
      selRow.appendChild(make('span', 'route-arrow', '→'));
      selRow.appendChild(targetSel);
      selRow.appendChild(del);
      row.appendChild(selRow);
      depthRow.appendChild(depth);
      depthRow.appendChild(out);
      row.appendChild(depthRow);
      routesBox.appendChild(row);
    });
  }
  renderRoutes();

  return {
    root,
    sync(): void {
      for (const s of lfoRows) s();
      renderRoutes();
    },
  };
}

/** Бейджи ∿ на модулированных слайдерах карточек. */
export function updateModBadges(mod: ModState): void {
  for (const badge of Array.from(document.querySelectorAll('.mod-badge'))) badge.remove();
  for (const route of mod.routes) {
    if (route.depth === 0) continue;
    const slider = document.getElementById(`p_${route.card}_${route.param}`);
    const row = slider?.parentElement;
    const label = row?.querySelector('span');
    if (label && !label.querySelector('.mod-badge')) {
      const b = document.createElement('span');
      b.className = 'mod-badge';
      b.textContent = ' ∿';
      b.title = 'Modulated by LFO';
      label.appendChild(b);
    }
  }
}
