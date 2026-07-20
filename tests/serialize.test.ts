// Сериализация состояния: sanitize, share-токены, round-trip.
import { sanitizeState, stateToParams, paramsToState } from '../src/state/schema';
import { encodeStateToken, decodeStateToken, tokenFromHash, b64urlEncode } from '../src/state/share';
import { defaultParams } from '../src/geo/build';

describe('sanitizeState', () => {
  it('отбрасывает мусорные типы', () => {
    expect(sanitizeState(null)).toBeNull();
    expect(sanitizeState(42)).toBeNull();
    expect(sanitizeState('x')).toBeNull();
  });

  it('фильтрует неизвестные профили/крышки/карточки', () => {
    const out = sanitizeState({
      profile: 'nope',
      caps: 'weird',
      heightMm: 100,
      displace: { hacker: { on: true }, ripples: { on: true, params: { amp: 0.5, evil: NaN } } },
    });
    expect(out).not.toBeNull();
    expect(out?.profile).toBeUndefined();
    expect(out?.caps).toBeUndefined();
    expect(out?.heightMm).toBe(100);
    expect(out?.displace?.hacker).toBeUndefined();
    expect(out?.displace?.ripples?.params?.amp).toBe(0.5);
    expect(out?.displace?.ripples?.params?.evil).toBeUndefined();
  });

  it('heightMm клампится в [5, 400]', () => {
    expect(sanitizeState({ heightMm: 9000 })?.heightMm).toBe(400);
    expect(sanitizeState({ heightMm: -3 })?.heightMm).toBe(5);
    expect(sanitizeState({ heightMm: NaN })?.heightMm).toBeUndefined();
  });
});

describe('stateToParams', () => {
  it('частичное состояние ложится поверх дефолтов', () => {
    const p = stateToParams({
      profile: 'bowl',
      displace: { noise: { on: true, params: { amp: 0.05 } } },
    });
    expect(p.profile).toBe('bowl');
    expect(p.displace.noise.on).toBe(true);
    expect(p.displace.noise.params.amp).toBe(0.05);
    // незатронутые параметры — дефолтные
    expect(p.displace.noise.params.scale).toBe(defaultParams().displace.noise.params.scale);
    expect(p.displace.ripples.on).toBe(true);
  });

  it('чужие ключи параметров не просачиваются', () => {
    const p = stateToParams({ displace: { ripples: { params: { amp: 0.1, hack: 99 } } } });
    expect(p.displace.ripples.params.amp).toBe(0.1);
    expect(p.displace.ripples.params.hack).toBeUndefined();
  });
});

describe('share round-trip', () => {
  it('encode → decode восстанавливает состояние', () => {
    const params = defaultParams();
    params.profile = 'goblet';
    params.displace.harmonics.on = true;
    params.displace.harmonics.params.l = 7;
    params.deform.twist = { on: true, params: { turns: 0.4 } };
    const state = paramsToState(params, 150, 'My goblet');
    const token = encodeStateToken(state);
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
    const decoded = decodeStateToken(token);
    expect(decoded?.presetName).toBe('My goblet');
    expect(decoded?.heightMm).toBe(150);
    const p2 = stateToParams(decoded ?? {});
    expect(p2.profile).toBe('goblet');
    expect(p2.displace.harmonics.on).toBe(true);
    expect(p2.displace.harmonics.params.l).toBe(7);
    expect(p2.deform.twist.on).toBe(true);
    expect(p2.deform.twist.params.turns).toBe(0.4);
  });

  it('битые токены → null', () => {
    expect(decodeStateToken('%%%')).toBeNull();
    expect(decodeStateToken(b64urlEncode('not json'))).toBeNull();
    expect(decodeStateToken(b64urlEncode('42'))).toBeNull();
  });

  it('tokenFromHash', () => {
    expect(tokenFromHash('#s=abc-_9')).toBe('abc-_9');
    expect(tokenFromHash('#other')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });
});
