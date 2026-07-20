// Пространственные LFO и матрица модуляции: формы, источники, effectiveParam,
// сшитость шва, эффект маршрутов в конвейере.
import { lfoValueAt, lfoCoord, effectiveParam, MOD_TARGETS, defaultModState, defaultLfo } from '../src/geo/mod';
import type { SpatialLfoDef } from '../src/geo/mod';
import { DISPLACE_CARDS, DEFORM_CARDS } from '../src/formulas';
import { buildMesh, defaultParams } from '../src/geo/build';
import { profileById, profileRadius } from '../src/geo/profiles';

const CTX = { height: 1 };
const at = (lfo: SpatialLfoDef, u: number, v: number, px = 0, py = 0, pz = 0): number =>
  lfoValueAt(lfo, u, v, px, py, pz, CTX);

function lfo(over: Partial<SpatialLfoDef>): SpatialLfoDef {
  return { ...defaultLfo(), ...over };
}

describe('формы LFO (источник z, rate 1)', () => {
  it('sine: sin(2π·v)', () => {
    const l = lfo({ shape: 'sine', rate: 1 });
    expect(at(l, 0, 0.25)).toBeCloseTo(1, 9);
    expect(at(l, 0, 0.5)).toBeCloseTo(0, 9);
  });

  it('triangle: пик в v=0.25/0.75', () => {
    const l = lfo({ shape: 'triangle', rate: 1 });
    expect(at(l, 0, 0)).toBeCloseTo(-1, 9);
    expect(at(l, 0, 0.25)).toBeCloseTo(0, 9);
    expect(at(l, 0, 0.5)).toBeCloseTo(1, 9);
    expect(at(l, 0, 0.75)).toBeCloseTo(0, 9);
  });

  it('saw: 2·frac − 1', () => {
    const l = lfo({ shape: 'saw', rate: 1 });
    expect(at(l, 0, 0.75)).toBeCloseTo(0.5, 9);
  });

  it('square: ±1 по полуциклам', () => {
    const l = lfo({ shape: 'square', rate: 2 });
    expect(at(l, 0, 0.1)).toBe(1);
    expect(at(l, 0, 0.3)).toBe(-1);
  });

  it('random (S&H): константа внутри цикла, детерминирована', () => {
    const l = lfo({ shape: 'random', rate: 4 });
    expect(at(l, 0, 0.1)).toBe(at(l, 0, 0.2));
    expect(at(l, 0, 0.1)).not.toBe(at(l, 0, 0.3));
    expect(at(l, 0, 0.6)).toBe(at(l, 0, 0.6));
    expect(Math.abs(at(l, 0, 0.9))).toBeLessThanOrEqual(1);
  });

  it('фаза сдвигает цикл', () => {
    const a = lfo({ shape: 'sine', rate: 1, phase: 0 });
    const b = lfo({ shape: 'sine', rate: 1, phase: 0.25 });
    expect(at(b, 0, 0)).toBeCloseTo(at(a, 0, 0.25), 9);
  });
});

describe('источники координат', () => {
  it('theta: u/2π; целый rate бесшовен на шве', () => {
    const l = lfo({ source: 'theta', shape: 'sine', rate: 3 });
    expect(at(l, 0, 0.5)).toBeCloseTo(at(l, 2 * Math.PI, 0.5), 9);
  });

  it('spiral: v + k·θ/2π, бесшовна при целых rate·k', () => {
    const l = lfo({ source: 'spiral', shape: 'sine', rate: 2, k: 3 });
    expect(at(l, 0, 0.4)).toBeCloseTo(at(l, 2 * Math.PI, 0.4), 9);
  });

  it('radius: r/0.5', () => {
    const l = lfo({ source: 'radius' });
    expect(lfoCoord(l, 0, 0, 0.3, 0.4, 0, CTX)).toBeCloseTo(1, 9);
  });

  it('dist: расстояние от центра, норм. на height/2', () => {
    const l = lfo({ source: 'dist' });
    expect(lfoCoord(l, 0, 0, 0, 0, 1, CTX)).toBeCloseTo(1, 9);
    expect(lfoCoord(l, 0, 0, 0, 0, 0.5, CTX)).toBeCloseTo(0, 9);
  });
});

describe('effectiveParam', () => {
  it('линейный: base + depth·range·l, кламп', () => {
    expect(effectiveParam(0.5, 1, 0.5, [0, 1], false)).toBeCloseTo(1, 9);
    expect(effectiveParam(0.5, -1, 0.5, [0, 1], false)).toBeCloseTo(0, 9);
    expect(effectiveParam(0.5, 1, 1, [0, 1], false)).toBe(1);
  });

  it('exp: маппинг в октавах', () => {
    // диапазон [1, 8] → 3 октавы; l=1, depth=1/3 → ×2
    expect(effectiveParam(2, 1, 1 / 3, [1, 8], true)).toBeCloseTo(4, 6);
    expect(effectiveParam(2, 0, 1, [1, 8], true)).toBeCloseTo(2, 9);
  });

  it('exp с min=0 откатывается к линейному', () => {
    expect(effectiveParam(0.5, 1, 0.5, [0, 1], true)).toBeCloseTo(1, 9);
  });
});

describe('MOD_TARGETS ↔ UI-схема', () => {
  it('каждая цель существует и диапазон совпадает со слайдером', () => {
    const cards = [...DISPLACE_CARDS, ...DEFORM_CARDS];
    for (const t of MOD_TARGETS) {
      const card = cards.find((c) => c.id === t.card);
      expect(card, `нет карточки ${t.card}`).toBeDefined();
      const slider = card?.sliders.find((s) => s.k === t.param);
      expect(slider, `нет слайдера ${t.card}.${t.param}`).toBeDefined();
      expect([slider?.min, slider?.max]).toEqual([t.range[0], t.range[1]]);
    }
  });
});

describe('модуляция в конвейере', () => {
  it('маршрут с depth=0 не меняет геометрию', () => {
    const a = defaultParams();
    a.nu = 32;
    a.nv = 32;
    const b = defaultParams();
    b.nu = 32;
    b.nv = 32;
    b.mod.routes.push({ src: 0, card: 'ripples', param: 'amp', depth: 0 });
    expect(Array.from(buildMesh(b).positions)).toEqual(Array.from(buildMesh(a).positions));
  });

  it('LFO(z, square)→ripples.amp: низ рифлёный, верх гладкий', () => {
    const p = defaultParams();
    p.nu = 48;
    p.nv = 48;
    p.mod.lfos[0] = { source: 'z', shape: 'square', rate: 1, phase: 0, k: 1 };
    p.mod.routes.push({ src: 0, card: 'ripples', param: 'amp', depth: 0.5 });
    const mesh = buildMesh(p);
    const def = profileById('vase');
    // отклонение радиуса от базового профиля в кольце j
    const dev = (j: number): number => {
      let max = 0;
      const base = profileRadius(def, j / 48);
      for (let i = 0; i < 48; i++) {
        const k = (j * 48 + i) * 3;
        max = Math.max(max, Math.abs(Math.hypot(mesh.positions[k], mesh.positions[k + 1]) - base));
      }
      return max;
    };
    // v=0.25: amp ≈ 0.02+0.5·0.15 ≈ 0.095; v=0.75: amp клампится в 0
    expect(dev(12)).toBeGreaterThan(0.05);
    expect(dev(36)).toBeLessThan(0.012);
  });

  it('модуляция деформера: LFO(z)→twist.turns строит валидный меш', () => {
    const p = defaultParams();
    p.nu = 32;
    p.nv = 32;
    p.deform.twist.on = true;
    p.mod.routes.push({ src: 0, card: 'twist', param: 'turns', depth: 0.8 });
    const mesh = buildMesh(p);
    for (const x of mesh.positions) expect(Number.isFinite(x)).toBe(true);
  });

  it('defaultModState: 3 LFO, маршрутов нет', () => {
    const m = defaultModState();
    expect(m.lfos.length).toBe(3);
    expect(m.routes.length).toBe(0);
  });
});
