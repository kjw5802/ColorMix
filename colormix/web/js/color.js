// 색 계산. 화면(DOM)을 건드리지 않는 순수 함수만 둔다.
// sRGB(0~255) ↔ 선형 RGB(0~1) ↔ CIE L*a*b*(D65). 색차는 ΔE76(L*a*b* 거리).

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

// sRGB 감마 풀기/씌우기
const toLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) };
const toS = v => 255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055);

function lin2lab(l) {
  const X = (.4124 * l[0] + .3576 * l[1] + .1805 * l[2]) / .95047;
  const Y = .2126 * l[0] + .7152 * l[1] + .0722 * l[2];
  const Z = (.0193 * l[0] + .1192 * l[1] + .9505 * l[2]) / 1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const rgbLab = c => lin2lab(c.map(toLin));
const hex2lab = h => rgbLab(hex2rgb(h));
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// ΔE 판정 문구 키: 3 미만 거의 같음, 8 미만 가까움, 그 이상 차이 큼
const deKey = de => de < 3 ? "de0" : de < 8 ? "de1" : "de2";
// 밝은 바탕인지 (그 위 글자를 검정으로 쓸지)
const isLight = c => .3 * c[0] + .59 * c[1] + .11 * c[2] > 140;

// 인쇄 CMYK: ICC 프로파일 없이 단순 공식으로 환산한 참고값 (%)
function rgb2cmyk(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(v => Math.round(v * 100));
}

// HSV: H는 도, S·V는 %
function rgb2hsv(c) {
  const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    h = mx == r ? ((g - b) / d) % 6 : mx == g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx * 100 : 0, mx * 100];
}

// ---- 혼합 모델: 채널별 Kubelka-Munk 근사 ----
// 반사율 r(선형) → K/S 값. 섞을 때는 K/S를 부피 비율로 평균하고 다시 반사율로 돌린다
const ks = r => { r = Math.min(.98, Math.max(.02, r)); return (1 - r) * (1 - r) / (2 * r) };
const refl = k => 1 + k - Math.sqrt(k * k + 2 * k);
const paintK = hex => hex2rgb(hex).map(toLin).map(ks);

// K: 도료별 [R,G,B] K/S 값, parts: 부피 비율 → 섞은 색의 선형 RGB
function mix(K, parts) {
  const total = parts.reduce((a, b) => a + b, 0);
  return [0, 1, 2].map(ch => refl(K.reduce((s, k, i) => s + k[ch] * parts[i], 0) / total));
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;

// 배합 제안: 도료 1~3종을 10등분 비율로 섞은 모든 조합 중 목표색과 ΔE가 가장 작은 3개.
// 결과: {idx: paints 안의 순번들, parts: 비율, rgb: 예상 색(sRGB), de: 색차}
function recipes(target, paints) {
  const tl = rgbLab(target);
  // 도료가 많으면 목표색에 가까운 12가지 + 가장 밝은/어두운 도료만 후보로 써서 계산량을 줄인다
  let cand = paints.map((p, i) => i);
  if (paints.length > 14) {
    const L = paints.map(p => hex2lab(p.hex)), d = L.map(l => deltaE(l, tl));
    const near = cand.slice().sort((a, b) => d[a] - d[b]).slice(0, 12);
    const light = cand.reduce((a, b) => L[b][0] > L[a][0] ? b : a);
    const dark = cand.reduce((a, b) => L[b][0] < L[a][0] ? b : a);
    cand = [...new Set([...near, light, dark])];
  }
  const K = cand.map(i => paintK(paints[i].hex)), n = K.length, N = 10, out = [];
  const test = (idx, parts) => {
    const l = mix(idx.map(i => K[i]), parts);
    out.push({idx, parts, rgb: l.map(toS), de: deltaE(lin2lab(l), tl)});
  };
  for (let a = 0; a < n; a++) {
    test([a], [1]);
    for (let b = a + 1; b < n; b++) {
      for (let i = 1; i < N; i++) test([a, b], [i, N - i]);
      for (let c = b + 1; c < n; c++)
        for (let i = 1; i < N - 1; i++)
          for (let j = 1; i + j < N; j++) test([a, b, c], [i, j, N - i - j]);
    }
  }
  out.sort((x, y) => x.de - y.de);
  // 같은 도료 조합은 가장 좋은 비율 하나만 남긴다
  const res = [], seen = new Set();
  for (const r of out) {
    const key = r.idx.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    res.push(r);
    if (res.length == 3) break;
  }
  res.forEach(r => { r.idx = r.idx.map(i => cand[i]) });
  return res;
}

// 도료 배합비 C·M·Y·K·W (%): 원색 5개(primK: 각 원색의 K/S)를 섞어 목표색과 ΔE가 가장 작아지는 부피 비율.
// 5% 단위로 전부 찾은 뒤, 두 성분 사이에서 1%, 0.5%씩 옮기며 다듬는다 (옅은 색은 미량 차이가 크다)
function cmykw(rgb, primK) {
  const tl = rgbLab(rgb), N = 20;
  const err = parts => deltaE(lin2lab(mix(primK, parts)), tl);
  let best = null, bd = 1e9;
  for (let a = 0; a <= N; a++)
    for (let b = 0; a + b <= N; b++)
      for (let c = 0; a + b + c <= N; c++)
        for (let d = 0; a + b + c + d <= N; d++) {
          const parts = [a, b, c, d, N - a - b - c - d], de = err(parts);
          if (de < bd) { bd = de; best = parts }
        }
  let x = best.map(v => v * 5);
  for (const step of [1, .5]) {
    let improved = true, guard = 0;
    while (improved && guard++ < 400) {
      improved = false;
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          if (i == j || x[j] < step) continue;
          const y = x.slice();
          y[i] += step;
          y[j] -= step;
          const de = err(y);
          if (de < bd - 1e-6) { bd = de; x = y; improved = true }
        }
    }
  }
  return x.map(v => Math.round(v * 10) / 10);
}
