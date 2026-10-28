// 스포이드 화면 오른쪽: 찍은 색의 값, 배합 제안, 명암 세트.

let brand = "tamiya";   // 배합 제안에 쓰는 브랜드 ("mix"면 락카 브랜드 혼합)
let NOMETAL = true;     // 펄·메탈릭 제외 스위치
let SETOPEN = false;    // 명암 세트 펼침 상태

const brandPool = b => b == "mix" ? LACQUER : [b];
// 배합에 쓸 도료: 고른 브랜드의 보유 도료 (무색 클리어, 스위치가 켜져 있으면 메탈릭 제외)
const mixPaints = () => PAINTS.filter(p =>
  brandPool(brand).includes(p.brand) && p.own && !isClear(p) && !(NOMETAL && p.type == "metallic"));

// 브랜드 혼합: 전체 후보 계산에 브랜드별 계산을 더해 ΔE 순으로 고른다.
// recipes()가 후보를 줄이는 단계에서 한 브랜드 안의 좋은 조합이 빠지지 않게 한다
function bestMixes(target, P) {
  if (brand != "mix") return recipes(target, P);
  const all = recipes(target, P);
  for (const b of LACQUER) {
    const ix = P.map((p, i) => p.brand == b ? i : -1).filter(i => i >= 0);
    if (!ix.length) continue;
    for (const r of recipes(target, ix.map(i => P[i]))) all.push(Object.assign({}, r, {idx: r.idx.map(j => ix[j])}));
  }
  all.sort((x, y) => x.de - y.de);
  const res = [], seen = new Set();
  for (const r of all) {
    const key = r.idx.slice().sort((a, b) => a - b).join();
    if (seen.has(key)) continue;
    seen.add(key);
    res.push(r);
    if (res.length == 3) break;
  }
  return res;
}
const recLabel = p => (brand == "mix" ? "[" + BSHORT[p.brand] + "] " : "") + plabel(p);

// 도료 배합비 "C1.5 M0 Y2 K0 W96.5"
const mixText = m => PRIM.map((q, j) => q[0] + fmtN(m[j])).join(" ");
// C·M·Y 공통분(회색 성분)과 나머지(색 성분)로 나눈 설명 "회색 0.5 + 색 C1"
function mixSplitText(m) {
  const g = Math.min(m[0], m[1], m[2]);
  const col = ["C", "M", "Y"].map((q, j) => m[j] - g > 0.05 ? q + fmtN(m[j] - g) : "").filter(Boolean).join(" ");
  if (!col && !g) return t("mixNoColor");
  return g > 0.05 ? t("mixSplit", fmtN(g), col || "0") : "";
}

function render() {
  if (!picked) return;
  const c = picked, hex = rgb2hex(c);
  $("big").style.background = hex;
  $("hex").textContent = hex;
  $("rgb").textContent = c.map(Math.round).join(", ");
  const hsv = rgb2hsv(c);
  $("hsv").textContent = `H ${Math.round(hsv[0])}°  S ${hsv[1].toFixed(1)}%  V ${hsv[2].toFixed(1)}%`;
  // 채도 10% 미만은 회색에 가까운 색, 3% 미만은 색상각을 믿기 어렵다
  setMsg("satbadge", hsv[1] < 3 ? "satUnstable" : hsv[1] < 10 ? "satLow" : null, hsv[1].toFixed(1));
  const mx = mixOf(c), ms = mixSplitText(mx), mr = $("mixr");
  mr.textContent = mixText(mx);
  if (ms) mr.append(el("span", "mixsub", ms));
  mr.title = t("basis_" + BASIS);
  const k = rgb2cmyk(c);
  $("cmyk").textContent = `C ${k[0]}%  M ${k[1]}%  Y ${k[2]}%  K ${k[3]}%`;
  $("lab").textContent = rgbLab(c).map(v => v.toFixed(1)).join(", ");
  renderMixes(c);
}

function renderMixes(c) {
  const P = mixPaints(), box = $("recs");
  box.textContent = "";
  if (!P.length) {
    box.append(el("p", "note", t("noOwned")));
    $("mixnote").textContent = PAINTS.some(p => p.own && isClear(p)) ? t("clearMixNote") : "";
    return;
  }
  for (const r of bestMixes(c, P)) {
    const g = r.parts.reduce(gcd), row = el("div", "rec"), pair = el("div", "pair");
    for (const [label, x] of [[t("target"), c], [t("predicted"), r.rgb]]) {
      const s = el("span", "", label);
      s.style.background = rgb2hex(x);
      s.style.color = isLight(x) ? "#000" : "#fff";
      pair.append(s);
    }
    const ul = el("ul");
    r.idx.forEach((pi, i) => {
      const p = P[pi], chip = el("span", "chip");
      paintSwatch(chip, p);
      const li = el("li");
      li.append(chip, el("span", "", recLabel(p)));
      if (p.measured) li.append(measBadge(p));
      li.append(el("span", "parts", r.parts[i] / g));
      ul.append(li);
    });
    const right = el("div");
    right.append(ul, el("div", "de", `${t("ratio", r.parts.map(p => p / g).join(" : "))}  ·  ΔE ${r.de.toFixed(1)} (${t(deKey(r.de))})`));
    row.append(pair, right);
    box.append(row);
  }
  const nm = NOMETAL ? PAINTS.filter(p => brandPool(brand).includes(p.brand) && p.own && p.type == "metallic").length : 0;
  $("mixnote").textContent = t("note_" + brand) + " " + t("mixWarn") + (nm ? " " + t("noMetalNote", nm) : "");
}

// 배합 제안 위의 브랜드 버튼
function seg() {
  const s = $("seg");
  s.textContent = "";
  for (const b of [...BORDER, "mix"]) {
    const bt = button(bname(b), () => { brand = b; seg(); render() });
    bt.setAttribute("aria-pressed", b == brand);
    s.append(bt);
  }
}
$("nometal").onchange = () => { NOMETAL = $("nometal").checked; markDirty(); render() };

// ---- 명암 세트 ----
// 하이라이트·기본·그림자 세 칸. 칸을 고른 뒤 사진을 클릭하면 채워지고 다음 빈칸으로 넘어간다
const PARTS = ["skin", "hair", "eyes", "cloth", "stocking", "other"], TONES = ["hl", "base", "sh"];
let SET = {hl: null, base: null, sh: null}, slot = null;

// 기본색 대비 명도 차(L*)와 색 방향(a*·b* 차 2 초과), 채도 차(3 초과)를 말로 쓴다
function relWords(a, b) {
  const A = rgbLab(a), B = rgbLab(b), w = [];
  const da = A[1] - B[1], db = A[2] - B[2], dc = Math.hypot(A[1], A[2]) - Math.hypot(B[1], B[2]);
  // 기본색이 이미 반대쪽(초록/푸른 쪽)이면 "덜 초록빛으로/덜 푸르게"로 읽는 편이 자연스럽다
  if (da > 2) w.push(t(B[1] < -2 ? "relLessGreen" : "relRed"));
  else if (da < -2) w.push(t(B[1] > 2 ? "relLessRed" : "relGreen"));
  if (db > 2) w.push(t(B[2] < -2 ? "relLessBlue" : "relYellow"));
  else if (db < -2) w.push(t(B[2] > 2 ? "relLessYellow" : "relBlue"));
  if (dc > 3) w.push(t("relSat"));
  else if (dc < -3) w.push(t("relDesat"));
  const dL = Math.round(A[0] - B[0]);
  return [(dL > 0 ? "+" : "") + dL, w.length ? w.join(t("sep")) : t("relSame")];
}
function renderSet() {
  for (const k of TONES) {
    const b = $("slot-" + k), c = SET[k], sw = b.querySelector(".ssw");
    b.setAttribute("aria-pressed", slot == k);
    sw.style.background = c ? rgb2hex(c) : "";
    sw.classList.toggle("on", !!c);
    b.querySelector(".shx").textContent = c ? rgb2hex(c) : "—";
  }
  const rel = $("rel");
  rel.textContent = "";
  if (!SET.base) {
    if (SET.hl || SET.sh) rel.append(el("li", "note", t("relNeedBase")));
    return;
  }
  for (const k of ["hl", "sh"]) {
    if (!SET[k]) continue;
    const r = relWords(SET[k], SET.base);
    rel.append(el("li", "", t("relLine", t("tone_" + k), r[0], r[1])));
  }
}
function fillSlot() {
  if (!slot || !picked) return false;
  SET[slot] = picked.map(Math.round);
  slot = TONES.find(k => !SET[k]) || null;
  renderSet();
  return true;
}
TONES.forEach(k => { $("slot-" + k).onclick = () => { slot = slot == k ? null : k; renderSet() } });
$("setclear").onclick = () => {
  SET = {hl: null, base: null, sh: null};
  slot = "hl";
  renderSet();
  setMsg("setmsg");
};
$("setadd").onclick = () => {
  const part = $("part").value, filled = TONES.filter(k => SET[k]);
  if (!filled.length) { setMsg("setmsg", "setEmpty"); return }
  const seq = ++ADDSEQ;
  for (const k of filled) {
    const c = SET[k];
    PAL.push({rgb: c.slice(), hex: rgb2hex(c), mix: mixOf(c), part, tone: k, seq});
  }
  setMsg("setmsg", "setAdded", filled.length);
  palChanged();
};
const partOptions = () => fillOptions($("part"), PARTS, k => t("part_" + k), "skin");
// 펼침 상태는 화면 상태라 "저장 안 됨"으로 만들지 않고, 다음 저장 때 함께 기록한다. 펼치면 오른쪽 칸 높이를 다시 맞춘다
$("setbox").addEventListener("toggle", () => { SETOPEN = $("setbox").open; fitSide() });
