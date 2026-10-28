// "보유 도료" 탭(카드로 보기)과 "도료 관리" 탭(추가, 보유 체크, 색상값·종류·광택·측정값 편집).

// ---- 보유 도료 ----
function renderOwned() {
  const f = $("tfilter").value, ff = $("ffilter").value, owned = PAINTS.filter(p => p.own), g = $("ownedgrid");
  g.textContent = "";
  const typeOk = p => f == "all" || (f == "colorless" ? isClear(p) : f == "clear" ? p.type == "clear" && !isClear(p) : p.type == f);
  const list = owned.filter(p => typeOk(p) && (ff == "all" || p.finish == ff)).sort(SORTS[$("sort").value]);
  $("ownedcount").textContent = t("ownedCount", owned.length, PAINTS.length);
  for (const p of list) {
    const card = el("div", "card"), sw = el("div", "sw"), tx = el("div", "t");
    paintSwatch(sw, p);
    const nm = pname(p), same = nm.toLowerCase() == p.no.toLowerCase();
    tx.append(
      el("b", "", p.no),
      el("span", "", same ? "" : noIsName(p) ? "(" + nm + ")" : nm),
      el("span", "mono", bname(p.brand)),
      el("span", "badge", typeName(p)),
    );
    if (p.measured) tx.append(measBadge(p));
    tx.append(
      el("span", "mono", isClear(p) ? t("colorless") : p.hex.toUpperCase() + " · " + hueText(p).split(" ")[0]),
      el("span", "mono", t("tintLabel") + " " + (p.tinting_strength == null ? t("unmeasured") : fmtN(p.tinting_strength))),
    );
    card.append(sw, tx);
    g.append(card);
  }
  if (!list.length) g.append(el("p", "note", t("ownedNone")));
}
$("tfilter").onchange = renderOwned;
$("ffilter").onchange = renderOwned;
$("sort").onchange = () => { markDirty(); renderOwned() };

// ---- 도료 관리 ----
// 브랜드 탭: 고른 브랜드만 보여 준다(처음에는 배합 제안의 브랜드). 검색어가 있으면 탭과 상관없이 전체 브랜드에서 찾는다
let PBRAND = null;
const curPBrand = () => PBRAND || (brand == "mix" ? "mr" : brand);

function paintTabs(q, ownedOnly) {
  const s = $("pbrand");
  s.textContent = "";
  for (const b of BORDER) {
    const n = PAINTS.filter(p => p.brand == b && (!ownedOnly || p.own)).length;
    const bt = button(bname(b), () => { PBRAND = b; $("psearch").value = ""; renderPaints(); toListTop() });
    bt.append(el("span", "cnt", n));
    bt.setAttribute("aria-pressed", !q && b == curPBrand());
    s.append(bt);
  }
}
// 탭을 바꿨을 때 목록이 고정된 도구 줄 아래에서 시작하게 한다
function toListTop() {
  const r = $("rows").getBoundingClientRect().top, h = $("ptool").getBoundingClientRect().height;
  if (r < h) scrollBy(0, r - h - 8);
}

// 도료를 바꾼 뒤: 저장 안 됨 표시, 필요한 화면 다시 그리기
const changed = (...redraw) => { markDirty(); redraw.forEach(fn => fn()) };

function renderPaints() {
  const box = $("rows");
  box.textContent = "";
  const q = $("psearch").value.trim().toLowerCase(), ownedOnly = $("ponly").checked;
  paintTabs(q, ownedOnly);
  for (const b of q ? BORDER : [curPBrand()]) {
    const list = PAINTS.filter(p => p.brand == b && (!ownedOnly || p.own) && paintMatch(p, q)).sort(byNo);
    if (q && !list.length) continue;
    box.append(el("p", "grp", t("grp", bname(b), list.length)));
    const rows = el("div", "rows");
    for (const p of list) rows.append(paintRow(p));
    box.append(rows);
  }
}

// 도료 한 줄: 보유, 색(또는 무색 견본), 스포이드, 이름, 실측 배지, 종류, (무색), 광택, 색상값, 측정값
function paintRow(p) {
  const id = (p.brand + "-" + p.no).replace(/[^\w-]/g, "_"), row = el("div", "row");
  const aria = (e, key) => e.setAttribute("aria-label", p.no + " " + t(key));

  const own = el("input");
  own.type = "checkbox";
  own.id = "own-" + id;
  own.checked = p.own;
  own.title = t("own");
  aria(own, "own");
  own.onchange = () => { p.own = own.checked; changed(render) };
  const nm = el("label", "nm", plabel(p));
  nm.htmlFor = own.id;
  const hx = el("span", "mono", isClear(p) ? t("colorless") : p.hex.toUpperCase());

  let sw;
  if (isClear(p)) {
    sw = el("span", "nocolor");
    paintSwatch(sw, p);
    sw.title = t("colorless");
  } else {
    sw = el("input");
    sw.type = "color";
    sw.id = "hex-" + id;
    sw.value = p.hex;
    aria(sw, "color");
    sw.oninput = () => { p.hex = sw.value; hx.textContent = sw.value.toUpperCase(); changed(render) };
  }

  const ty = el("select");
  ty.id = "type-" + id;
  aria(ty, "typeLabel");
  fillOptions(ty, TYPES, k => t("type_" + k));
  ty.value = p.type;
  ty.onchange = () => { p.type = ty.value; if (p.type != "clear") p.colorless = false; changed(renderPaints, render) };

  const fi = el("select");
  fi.id = "finish-" + id;
  aria(fi, "finishLabel");
  fillOptions(fi, FINISHES, k => t("fin_" + k));
  fi.value = p.finish;
  fi.onchange = () => { p.finish = fi.value; changed(renderOwned) };

  row.append(own, sw);
  if (!isClear(p)) row.append(eyeBtn(p));
  row.append(nm);
  const mb = measBadge(p);
  if (mb) row.append(mb);
  row.append(ty);
  if (p.type == "clear") {
    const lb = el("label"), cb = el("input");
    cb.type = "checkbox";
    cb.id = "cl-" + id;
    cb.checked = p.colorless;
    cb.onchange = () => { p.colorless = cb.checked; if (p.colorless) p.hex = "#ffffff"; changed(renderPaints, render) };
    lb.append(cb, " " + t("colorless"));
    row.append(lb);
  }
  row.append(fi, hx);

  // 투명도·착색력·색상각: "측정값 편집"을 켰을 때만 입력칸을 보여 목록을 한 줄로 유지한다
  if (!$("pmeas").checked) {
    const s = [p.opacity && t("op_" + p.opacity), p.tinting_strength != null && t("tintLabel") + " " + fmtN(p.tinting_strength)].filter(Boolean).join(" · ");
    if (s) row.append(el("span", "mono", s));
  } else {
    const op = el("select");
    op.id = "op-" + id;
    aria(op, "opacityLabel");
    fillOptions(op, ["", ...OPACITIES], k => k ? t("op_" + k) : t("op_none"));
    op.value = p.opacity || "";
    op.onchange = () => { p.opacity = op.value || null; changed(renderOwned) };
    const ts = el("input", "tint");
    ts.type = "number";
    ts.min = "0.01";
    ts.step = "0.1";
    ts.id = "ts-" + id;
    ts.placeholder = t("tintLabel") + " " + t("unmeasured");
    ts.title = t("tintLabel");
    aria(ts, "tintLabel");
    ts.value = p.tinting_strength == null ? "" : p.tinting_strength;
    ts.onchange = () => {
      const v = parseFloat(ts.value);
      p.tinting_strength = isFinite(v) && v > 0 ? v : null;
      if (p.tinting_strength == null) ts.value = "";
      changed(renderOwned);
    };
    row.append(op, ts, el("span", "mono hue", hueText(p)), ...revertBtns(p));
  }
  // 직접 추가한 도료만 지울 수 있다
  if (p.custom) row.append(button(t("del"), () => { PAINTS.splice(PAINTS.indexOf(p), 1); changed(renderPaints, render) }));
  return row;
}
$("psearch").oninput = renderPaints;
$("ponly").onchange = renderPaints;
$("pmeas").onchange = renderPaints;

// ---- 도료 추가 ----
function brandOptions() {
  fillOptions($("add-brand"), BORDER, bname);
  addFormSync();
}
// 종류가 클리어일 때만 "무색"을 보이고, 무색이면 색 고르기를 숨긴다
function addFormSync() {
  const clear = $("add-type").value == "clear";
  $("add-cl-wrap").hidden = !clear;
  if (!clear) $("add-colorless").checked = false;
  $("add-hex").hidden = clear && $("add-colorless").checked;
}
$("add-type").onchange = addFormSync;
$("add-colorless").onchange = addFormSync;
// 같은 브랜드·번호가 있으면 그 도료를 덮어쓴다
$("add").addEventListener("submit", e => {
  e.preventDefault();
  const no = $("add-no").value.trim(), name = $("add-name").value.trim(), b = $("add-brand").value;
  if (!no || !name) return;
  const type = $("add-type").value, colorless = type == "clear" && $("add-colorless").checked;
  const finish = $("add-finish").value, hex = colorless ? "#ffffff" : $("add-hex").value;
  const dup = PAINTS.find(p => p.brand == b && p.no.toLowerCase() == no.toLowerCase());
  if (dup) Object.assign(dup, {name, renamed: true, hex, type, colorless, finish, own: true});
  else PAINTS.push({brand: b, no, name, hex, type, colorless, finish, own: true, custom: true});
  $("add-no").value = "";
  $("add-name").value = "";
  changed(renderPaints, render);
});

// 초기화는 5초 안에 한 번 더 눌러야 실행된다
let resetArmed = null;
$("reset").onclick = () => {
  if (!resetArmed) {
    setMsg("resetmsg", "resetSure");
    resetArmed = setTimeout(() => { resetArmed = null; setMsg("resetmsg") }, 5000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = null;
  PAINTS = norm(DEFAULTS);
  changed(renderPaints, render);
  setMsg("resetmsg", "resetDone");
};
