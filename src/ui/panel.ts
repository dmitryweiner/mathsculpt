// Панель на контролах кита: строки «Shape», карточки носителя (видна только
// карточка выбранного), карточки смещений и деформеров (включение — первой
// строкой-галочкой внутри карточки, правило кита) и карточка модуляции.
// Карточки рисуются один раз; правка из любого места — `sync(state)`.

import { createCard } from 'maker-kit/ui/card';
import type { CardHandle } from 'maker-kit/ui/card';
import type { ControlsHandle } from 'maker-kit/ui/controls';
import { renderControls } from 'maker-kit/ui/controls';
import type { CardDef } from '../formulas';
import { DEFORM_CARDS, DISPLACE_CARDS, FOURIER_CARD, PROFILE_SHAPE_CARD, SHAPE_CARDS } from '../formulas';
import { isProfileId } from '../geo/profiles';
import type { AppState } from '../state/schema';
import { renderModCard } from './modCard';
import type { PanelOptions } from './modCard';
import { carrierRows, effectRows, SHAPE_ROWS } from './rows';
import type { Row } from './rows';

export type { PanelOptions };

export interface PanelHosts {
  /** the rows of the Shape card */
  shape: HTMLElement;
  carriers: HTMLElement;
  displace: HTMLElement;
  deform: HTMLElement;
  mod: HTMLElement;
}

export interface PanelHandle {
  sync(state: AppState): void;
}

/** Какая карточка носителя относится к профилю: настройка формы — к пресет-профилям, остальные — к своему id. */
function carrierShown(def: CardDef, profile: string): boolean {
  return def.id === PROFILE_SHAPE_CARD.id ? isProfileId(profile) : def.id === profile;
}

/** Рисует панель в свои места, начисто: после смены языка — заново (свёрнутость карточек — `snapshotCards` кита). */
export function renderPanel(hosts: PanelHosts, o: PanelOptions): PanelHandle {
  for (const host of Object.values(hosts)) host.replaceChildren();
  const state = o.read();
  const syncs: ((state: AppState) => void)[] = [];
  const controls = (host: HTMLElement, rows: readonly Row[], idPrefix: string): ControlsHandle<AppState> =>
    renderControls(host, rows, { ...o, idPrefix });

  const shape = controls(hosts.shape, SHAPE_ROWS, 'shape');
  syncs.push((s) => shape.sync(s));

  for (const def of [PROFILE_SHAPE_CARD, FOURIER_CARD, ...SHAPE_CARDS]) {
    const card = createCard(hosts.carriers, { id: def.id, title: def.title, tag: def.tag, desc: def.desc, enabled: true, t: o.t });
    const rows = controls(card.body, carrierRows(def), `p_${def.id}`);
    syncs.push((s) => {
      card.card.hidden = !carrierShown(def, s.profile);
      rows.sync(s);
    });
  }

  const effect = (host: HTMLElement, def: CardDef, on: (s: AppState) => boolean): void => {
    const card: CardHandle = createCard(host, { id: def.id, title: def.title, tag: def.tag, desc: def.desc, enabled: on(state), t: o.t });
    const rows = controls(card.body, effectRows(def), `p_${def.id}`);
    syncs.push((s) => {
      card.setEnabled(on(s));
      rows.sync(s);
    });
  };
  for (const def of DISPLACE_CARDS) effect(hosts.displace, def, (s) => s.displace[def.id]?.on ?? false);
  for (const def of DEFORM_CARDS) effect(hosts.deform, def, (s) => s.deform[def.id]?.on ?? false);

  const mod = renderModCard(hosts.mod, o);
  syncs.push((s) => mod.sync(s));

  const handle: PanelHandle = {
    sync(s) {
      for (const sync of syncs) sync(s);
    },
  };
  handle.sync(state);
  return handle;
}
