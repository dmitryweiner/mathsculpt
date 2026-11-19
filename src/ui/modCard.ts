// The Modulation card: the pool of spatial LFOs and the routes LFO → a
// card's parameter → depth. The rows are the kit's (`ui/controls`), the
// routes the kit's list (`ui/listCard`, each open with its rows, ✕ in its
// head). Folded while there are no routes; it unfolds with the first. The ∿
// badge goes on the row of a modulated slider of any card.

import { createCard } from 'maker-kit/ui/card';
import type { ControlsHandle } from 'maker-kit/ui/controls';
import { renderControls } from 'maker-kit/ui/controls';
import { make } from 'maker-kit/ui/dom';
import { renderItemList } from 'maker-kit/ui/listCard';
import type { Translate } from 'maker-kit/core/message';
import { LFO_COUNT, MOD_TARGETS } from '../geo/mod';
import type { AppState } from '../state/schema';
import type { Key } from '../i18n';
import { lfoRows, routeRows, targetText } from './rows';

export interface PanelOptions {
  read(): AppState;
  /** a new state; `final`: one undo step (the kit's controls say when) */
  change(next: AppState, final: boolean): void;
  t: Translate<Key>;
}

export interface ModCardHandle {
  sync(state: AppState): void;
}

export function renderModCard(container: HTMLElement, o: PanelOptions): ModCardHandle {
  const { t } = o;
  const card = createCard(container, {
    id: 'mod',
    title: 'mod.title',
    tag: { text: 'LFO' },
    desc: 'mod.desc',
    enabled: o.read().mod.routes.length > 0,
    t,
  });

  const handles: ControlsHandle<AppState>[] = [];
  for (let i = 0; i < LFO_COUNT; i++) {
    card.body.append(make('h3', 'sub-title', t('lfo.title', { n: i + 1 })));
    const host = make('div');
    card.body.append(host);
    handles.push(renderControls(host, lfoRows(i), { ...o, idPrefix: `lfo${i}` }));
  }

  card.body.append(make('h3', 'sub-title', t('mod.routes')));
  const list = make('ul', 'item-list');
  list.id = 'routeList';
  const add = make('button', 'add-button', t('mod.route.add'));
  add.type = 'button';
  add.id = 'addRouteBtn';
  add.addEventListener('click', () => {
    const state = o.read();
    const [first] = MOD_TARGETS;
    if (!first) return;
    o.change(
      { ...state, mod: { ...state.mod, routes: [...state.mod.routes, { src: 0, card: first.card, param: first.param, depth: 0.5 }] } },
      true,
    );
  });
  card.body.append(list, add);

  // Route i's rows always read route i: after a removal their nodes and
  // handles stay right and simply show the next route.
  const routes: { node: HTMLElement; handle: ControlsHandle<AppState> }[] = [];
  const routeBody = (index: number): HTMLElement => {
    let entry = routes[index];
    if (!entry) {
      const node = make('div', 'route-body');
      entry = { node, handle: renderControls(node, routeRows(index, t), { ...o, idPrefix: `route${index}` }) };
      routes[index] = entry;
    }
    return entry.node;
  };

  const remove = (id: string): void => {
    const state = o.read();
    const index = Number(id);
    o.change({ ...state, mod: { ...state.mod, routes: state.mod.routes.filter((_, i) => i !== index) } }, true);
  };

  return {
    sync(state) {
      for (const handle of handles) handle.sync(state);
      const count = state.mod.routes.length;
      routes.length = Math.min(routes.length, count);
      renderItemList(list, {
        items: state.mod.routes.map((route, i) => ({
          id: String(i),
          title: t('mod.route.title', { n: i + 1 }),
          hint: `${t('lfo.title', { n: route.src + 1 })} → ${targetText(route.card, route.param, t)}`,
        })),
        body: (id) => routeBody(Number(id)),
        t,
        idPrefix: 'route',
        remove,
      });
      for (let i = 0; i < count; i++) routes[i]?.handle.sync(state);
      card.setEnabled(count > 0);
      markModulated(state, t);
    },
  };
}

/** The ∿ badges on the rows of the cards' modulated sliders. */
function markModulated(state: AppState, t: Translate<Key>): void {
  const wanted = new Set(state.mod.routes.filter((route) => route.depth !== 0).map((route) => `p_${route.card}_${route.param}`));
  for (const badge of document.querySelectorAll('.mod-badge')) {
    const input = badge.closest('.row')?.querySelector('input[type="range"]');
    if (!input || !wanted.has(input.id)) badge.remove();
    else wanted.delete(input.id);
  }
  for (const id of wanted) {
    const name = document.getElementById(id)?.closest('.row')?.querySelector('.row-name');
    if (!name) continue;
    const badge = make('span', 'mod-badge', ' ∿');
    badge.title = t('mod.badge');
    name.append(badge);
  }
}
