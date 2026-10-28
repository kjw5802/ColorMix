// 사진에서 도료 색상값 등록.
// 스포이드 화면의 사진·보정·평균·경고를 그대로 써서, 찍은 색을 도료의 색상값으로 등록한다. 마지막 측정의 조건만 도료에 저장한다.

// REG: 등록 진행 상태 {list: 도료들, i: 지금 순서, from: "paints"|"main", immediate: 지금 찍힌 색으로 바로 확인, done: 등록 수}
// CH: 도료 선택 창 상태 {multi: 여러 개 고르기, sel: 고른 도료들}
let REG = null, CH = null;
const regCur = () => REG && REG.list[REG.i];

// 사진 위의 안내 띠 "등록 중 (1/3): ... — 사진에서 견본을 클릭하세요"
function regBanner() {
  const b = $("regbar");
  if (!REG || REG.immediate) { b.hidden = true; return }
  const p = regCur();
  b.hidden = false;
  $("regtext").textContent = t("regBanner", REG.i + 1, REG.list.length, bname(p.brand) + " · " + plabel(p));
  $("regskip").hidden = REG.list.length < 2;
}
function regStart(list, from) {
  if (!list.length) return;
  REG = {list, i: 0, from, done: 0};
  setMsg("regmsg");
  show("main");
  regBanner();
}
function regEnd() {
  if (!REG) return;
  const {from, done} = REG;
  REG = null;
  $("regconf").hidden = true;
  regBanner();
  if (done) setMsg("regmsg", "regDone", done);
  if (from == "paints") show("paints");
}
function regNext() {
  REG.i++;
  REG.immediate = false;
  $("regconf").hidden = true;
  if (REG.i >= REG.list.length) regEnd();
  else regBanner();
}

// 확인 창: 지금 값 → 새 값, ΔE, 측정 조건(✓ 좋음 / 경고)
const condLi = (ok, key, ...args) => el("li", ok ? "ok" : "warn", t(key, ...args));
function regConfirm() {
  const p = regCur();
  if (!p || !picked) return;
  const nh = rgb2hex(picked), L = LASTPICK;
  $("regconftitle").textContent = bname(p.brand) + " · " + plabel(p) + (REG.list.length > 1 ? `  (${REG.i + 1}/${REG.list.length})` : "");
  $("rc-old").style.background = p.hex;
  $("rc-oldhex").textContent = p.hex.toUpperCase();
  $("rc-new").style.background = nh;
  $("rc-newhex").textContent = nh;
  const de = deltaE(hex2lab(p.hex), rgbLab(picked));
  $("rc-de").textContent = `ΔE ${de.toFixed(1)} (${t(deKey(de))})`;
  const ul = $("rc-cond");
  ul.textContent = "";
  if (!L) {
    ul.append(condLi(false, "regWarnNotPhoto"));
  } else {
    ul.append(L.wb ? condLi(true, "regCondWb_" + L.wb) : condLi(false, "regWarnNoWb"));
    ul.append(L.size > 1 ? condLi(true, "regCondSize", L.size + "×" + L.size) : condLi(false, "regWarnSize"));
    if (L.spread != null) ul.append(L.spread > SPREAD_WARN ? condLi(false, "regWarnSpread", L.spread.toFixed(1)) : condLi(true, "regCondSpread", L.spread.toFixed(1)));
    if (L.clip) ul.append(condLi(false, "regWarnClip"));
  }
  $("rc-note").value = p.measured ? p.measured.note : "";
  $("rc-skip").hidden = REG.list.length < 2;
  $("regconf").hidden = false;
  $("rc-ok").focus();
}
function regApply() {
  const p = regCur(), c = picked.map(Math.round), nh = rgb2hex(c).toLowerCase(), hsv = rgb2hsv(c), L = LASTPICK;
  if (p.hex != nh) p.hex_prev = p.hex;
  p.hex = nh;
  p.hue_deg = hsv[1] >= 3 ? Math.round(hsv[0]) : null;   // 채도 3% 미만이면 색상각을 믿기 어렵다
  p.measured = {
    date: localDate(), wb: L ? L.wb : null, size: L ? L.size : null, spread: L ? L.spread : null, clip: L ? L.clip : false,
    note: $("rc-note").value.trim().slice(0, 120),
  };
  REG.done++;
  markDirty();
  render();
  regNext();
}
$("rc-ok").onclick = regApply;
$("rc-again").onclick = () => { REG.immediate = false; $("regconf").hidden = true; regBanner(); show("main") };
$("rc-skip").onclick = regNext;
$("regskip").onclick = regNext;
$("rc-cancel").onclick = regEnd;
$("regcancel").onclick = regEnd;

// ---- 도료 선택 창 ----
// 한 개(스포이드에서 지금 색을 등록) 또는 여러 개(연속 찍기, 누른 순서대로)
function chooser(multi) {
  CH = {multi, sel: []};
  $("regq").value = "";
  $("regdlgtitle").textContent = t(multi ? "regBatchTitle" : "regPickTitle");
  $("regstart").hidden = !multi;
  renderChooser();
  $("regdlg").hidden = false;
  $("regq").focus();
}
function closeChooser() {
  $("regdlg").hidden = true;
  CH = null;
}
function renderChooser() {
  if (!CH) return;
  const q = $("regq").value.trim().toLowerCase(), box = $("reglist");
  box.textContent = "";
  // 보유 도료를 먼저, 최대 80개
  const cand = PAINTS.filter(p => !isClear(p) && paintMatch(p, q)).sort((a, b) => (b.own - a.own) || SORTS.brand(a, b)).slice(0, 80);
  for (const p of cand) {
    const b = button("", () => {
      if (!CH.multi) {
        closeChooser();
        REG = {list: [p], i: 0, from: "main", immediate: true, done: 0};
        regConfirm();
        return;
      }
      const i = CH.sel.indexOf(p);
      if (i >= 0) CH.sel.splice(i, 1);
      else CH.sel.push(p);
      renderChooser();
    }, "regitem");
    const sw = el("span", "chip");
    paintSwatch(sw, p);
    b.append(sw, el("span", "", plabel(p)), el("span", "mono", bname(p.brand) + (p.own ? " · " + t("own") : "")));
    b.setAttribute("aria-pressed", CH.sel.includes(p));
    box.append(b);
  }
  const s = $("regsel");
  s.textContent = "";
  if (CH.multi) {
    if (!CH.sel.length) s.append(el("span", "note", t("regSelNone")));
    CH.sel.forEach((p, i) => s.append(el("span", "regchip", (i + 1) + ". " + plabel(p))));
  }
  $("regstart").disabled = !CH.sel.length;
  $("regstart").textContent = t("regStart", CH.sel.length);
}
$("regq").oninput = renderChooser;
$("regdlgclose").onclick = closeChooser;
$("regdlg").addEventListener("click", e => { if (e.target === $("regdlg")) closeChooser() });
$("regstart").onclick = () => { const list = CH.sel.slice(); closeChooser(); regStart(list, "paints") };
$("regbatch").onclick = () => chooser(true);
$("regpick").onclick = () => chooser(false);

// ---- 도료 관리 줄에 붙이는 것: 스포이드 버튼, 되돌리기 ----
const EYEDROP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.3 1.7a2 2 0 0 1 2.9 2.9l-1.6 1.6.8.8-1.3 1.3-.8-.8-5.5 5.5H3.6v-2.2l5.5-5.5-.8-.8 1.3-1.3.8.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
function eyeBtn(p) {
  const b = button("", () => regStart([p], "paints"), "eyed");
  b.innerHTML = EYEDROP;
  b.title = t("regPhotoBtn");
  b.setAttribute("aria-label", p.no + " " + t("regPhotoBtn"));
  return b;
}
// "이전 값으로", "기본값으로". 되돌리면 측정 기록과 색상각도 지운다
function revertBtns(p) {
  const out = [];
  const mk = (key, fn) => out.push(button(t(key), () => {
    fn();
    p.measured = null;
    p.hue_deg = null;
    markDirty();
    renderPaints();
    render();
  }));
  if (p.hex_prev) mk("regRevertPrev", () => { p.hex = p.hex_prev; p.hex_prev = null });
  const d = defHex(p);
  if (d && d != p.hex) mk("regRevertDef", () => { p.hex_prev = p.hex; p.hex = d });
  return out;
}
