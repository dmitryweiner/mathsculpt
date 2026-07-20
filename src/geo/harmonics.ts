// Вещественные сферические гармоники Yₗₘ(θ, φ). Нормировка ×√(4π):
// Y₀₀ = 1, пики остальных — порядка единицы (удобно для слайдера амплитуды).

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Присоединённый полином Лежандра P_l^m(x), m ≥ 0, рекуррентно. */
export function legendreP(l: number, m: number, x: number): number {
  // P_m^m = (−1)^m (2m−1)!! (1−x²)^{m/2}
  let pmm = 1;
  if (m > 0) {
    const somx2 = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
    let fact = 1;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }
  if (l === m) return pmm;
  // P_{m+1}^m = x(2m+1)P_m^m
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pll;
}

/**
 * √(4π)·Yₗₘ(θ, φ) в вещественной форме: m>0 — cos(mφ), m<0 — sin(|m|φ).
 * |m| обрезается до l. phase сдвигает φ.
 */
export function sphericalHarmonic(l: number, m: number, theta: number, phi: number, phase = 0): number {
  const ll = Math.max(0, Math.round(l));
  const mm = Math.max(-ll, Math.min(ll, Math.round(m)));
  const am = Math.abs(mm);
  const norm = Math.sqrt((2 * ll + 1) * (factorial(ll - am) / factorial(ll + am)));
  const p = legendreP(ll, am, Math.cos(theta));
  if (mm === 0) return norm * p;
  const angular = mm > 0 ? Math.cos(am * phi + phase) : Math.sin(am * phi + phase);
  return Math.SQRT2 * norm * p * angular;
}
