// 라이브러리: 팔레트를 출처 정보(작품·행사·원형사 등)와 함께 저장한 기록들, 검색·필터, A4 PDF.
// 기록 하나 = 사진 한 장(축소본)에서 뽑은 색들 + 출처 정보. 데이터 파일의 palettes에 저장된다.

let SAVED = [], OPEN_ID = null, LVIEW = "entry";
const META = ["event", "date", "sculptor", "link", "memo"];
const HEXRE = /^#[0-9A-Fa-f]{6}$/;
const str = (v, n) => String(v == null ? "" : v).slice(0, n);
// 사진 축소본: 긴 변 최대 px, JPEG 품질, base64 길이 상한
const THUMB_MAX = 2400, THUMB_Q = .9, THUMB_LIMIT = 1500000;

// 기록을 저장 형식으로 정리한다 (길이 제한, 잘못된 값 버리기)
function cleanPal(x, id) {
  x = x || {};
  const colors = (Array.isArray(x.colors) ? x.colors : [])
    .filter(c => c && HEXRE.test(c.hex) && Array.isArray(c.rgb) && c.rgb.length == 3 && Array.isArray(c.mix) && c.mix.length == 5)
    .slice(0, 60)
    .map(c => {
      const o = {hex: c.hex.toUpperCase(), rgb: c.rgb.map(Number), mix: c.mix.map(Number)};
      if (PARTS.includes(c.part) && TONES.includes(c.tone)) { o.part = c.part; o.tone = c.tone }
      return o;
    });
  const thumbOk = typeof x.thumb == "string" && x.thumb.startsWith("data:image/jpeg;base64,") && x.thumb.length < THUMB_LIMIT * 1.4;
  return {
    id, name: str(x.name, 60), created: Number(x.created) || 0,
    event: str(x.event, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : "",
    sculptor: str(x.sculptor, 80),
    link: /^https?:\/\//i.test(x.link) ? str(x.link, 300) : "",
    memo: str(x.memo, 500),
    thumb: thumbOk ? x.thumb : "",
    colors,
  };
}
// 파일에 쓰는 모양 (id는 빼고)
const palBody = s => ({
  name: s.name, created: s.created, event: s.event || "", date: s.date || "", sculptor: s.sculptor || "",
  link: s.link || "", memo: s.memo || "", colors: s.colors, thumb: s.thumb,
});
const newId = () => "l" + Date.now() + Math.random().toString(36).slice(2, 6);

function addPalette(body) {
  SAVED.unshift(cleanPal(body, newId()));
  markDirty();
  renderLibrary();
}
function updatePalette(s, patch) {
  SAVED[SAVED.indexOf(s)] = cleanPal(Object.assign(palBody(s), patch), s.id);
  markDirty();
  renderLibrary();
}
function deletePalette(s) {
  SAVED = SAVED.filter(x => x !== s);
  markDirty();
  renderLibrary();
}

// 색 목록을 명암 세트로 묶는다: 같은 부위가 이어지고 같은 명암이 반복되지 않는 동안 한 세트. 부위 없는 색은 단색
function groupSets(colors) {
  const out = [];
  let cur = null;
  for (const c of colors) {
    if (!c.part) { out.push({part: null, tones: {base: c}}); cur = null; continue }
    if (!cur || cur.part != c.part || cur.tones[c.tone]) { cur = {part: c.part, tones: {}}; out.push(cur) }
    cur.tones[c.tone] = c;
  }
  return out;
}
const setsOf = (s, part) => groupSets(s.colors).filter(g => part == "all" || g.part == part);

// 검색어·부위·행사로 거른 기록 (날짜 최신순)
function libFilter() {
  const q = $("lq").value.trim().toLowerCase(), part = $("lpart").value, ev = $("levent").value;
  return SAVED.slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created)
    .filter(s => (!q || [s.name, s.event, s.sculptor, s.memo].some(v => v.toLowerCase().includes(q)))
      && (ev == "all" || s.event == ev)
      && (part == "all" || s.colors.some(c => c.part == part)));
}

const uniqueValues = key => [...new Set(SAVED.map(s => s[key]).filter(Boolean))].sort();
function libSelects() {
  fillOptions($("lpart"), ["all", ...PARTS], k => k == "all" ? t("allParts") : t("part_" + k), "all");
  fillOptions($("levent"), ["all", ...uniqueValues("event")], k => k == "all" ? t("allEvents") : k, "all");
  // 행사·원형사 입력칸의 자동 완성 후보: 전에 입력한 값들
  for (const [id, key] of [["dl-event", "event"], ["dl-sculptor", "sculptor"]]) {
    const dl = $(id);
    dl.textContent = "";
    for (const v of uniqueValues(key)) {
      const o = el("option");
      o.value = v;
      dl.append(o);
    }
  }
  document.querySelectorAll("#lview button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v == LVIEW));
  $("lprintnote").textContent = t("libPrintNote", bname(brand));
}
function metaLine(s) {
  const m = el("div", "lmeta"), parts = [s.event, s.date, s.sculptor].filter(Boolean);
  m.append(parts.join(" · "));
  if (s.link) {
    if (parts.length) m.append(" · ");
    const a = el("a", "", s.link.replace(/^https?:\/\//, "").slice(0, 40));
    a.href = s.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    m.append(a);
  }
  return m;
}
function swatchSmall(c, label) {
  const w = el("div", "lsw"), a = el("span"), b = el("span", "", label ? label : c.hex);
  a.style.background = c.hex;
  a.title = c.hex;
  w.append(a, b);
  return w;
}

function renderLibrary() {
  libSelects();
  const body = $("libbody");
  body.textContent = "";
  if (!SAVED.length) {
    $("lcount").textContent = "";
    body.append(el("p", "note", t("libNone")));
    return;
  }
  const part = $("lpart").value, list = libFilter();
  const nColors = list.reduce((n, s) => n + setsOf(s, part).reduce((m, g) => m + Object.keys(g.tones).length, 0), 0);
  $("lcount").textContent = t("libCount", list.length, nColors);
  if (!list.length) { body.append(el("p", "note", t("libEmpty"))); return }
  if (LVIEW == "part") renderByPart(body, list, part);
  else for (const s of list) body.append(recordCard(s, part));
}

// 부위별 모아 보기: 한 줄에 명암 세트 하나(하이라이트·기본·그림자 + 출처)
function renderByPart(body, list, part) {
  for (const s of list) for (const g of setsOf(s, part)) {
    const r = el("div", "lrow");
    for (const k of TONES) {
      const c = g.tones[k], d = el("div", "big2");
      if (c) {
        d.style.background = c.hex;
        d.style.color = isLight(c.rgb) ? "#111" : "#fff";
        d.textContent = (g.part ? t("tone_" + k) + " " : "") + c.hex;
      } else d.classList.add("checker");
      r.append(d);
    }
    const src = el("div", "lsrc linfo");
    src.append(el("span", "plabel", g.part ? t("part_" + g.part) : t("single")), el("b", "", s.name || "—"), metaLine(s));
    r.append(src);
    body.append(r);
  }
}

// 기록별 카드: 사진, 출처, 명암 세트(가로로 나열, 이어지는 단색은 "단색" 묶음 하나로), 열기·편집·삭제
function recordCard(s, part) {
  const card = el("div", "lcard"), info = el("div", "linfo");
  if (s.thumb) {
    const im = el("img");
    im.alt = "";
    im.src = s.thumb;
    card.append(im);
  } else card.append(el("span"));
  info.append(el("b", "", s.name || "—"), metaLine(s));
  if (s.memo) info.append(el("div", "lmeta", s.memo));
  const sets = el("div", "lsets");
  let single = null;
  for (const g of setsOf(s, part)) {
    if (!g.part) {
      if (!single) {
        single = el("div", "lset");
        single.append(el("span", "plabel", t("single")));
        sets.append(single);
      }
      single.append(swatchSmall(g.tones.base, ""));
      continue;
    }
    single = null;
    const row = el("div", "lset");
    row.append(el("span", "plabel", t("part_" + g.part)));
    for (const k of TONES) if (g.tones[k]) row.append(swatchSmall(g.tones[k], t("tone_" + k)));
    sets.append(row);
  }
  info.append(sets);
  const act = el("div", "lactions");
  // 삭제는 4초 안에 한 번 더 눌러야 지운다
  let armed = false;
  const del = button(t("del"), () => {
    if (!armed) {
      armed = true;
      del.textContent = t("sure");
      setTimeout(() => { armed = false; del.textContent = t("del") }, 4000);
      return;
    }
    deletePalette(s);
    if (OPEN_ID == s.id) setOpenRecord(null);
  });
  act.append(button(t("open"), () => openSaved(s)), button(t("edit"), () => editForm(s, info, act)), del);
  info.append(act);
  card.append(info);
  return card;
}

// 카드 안에서 출처 정보만 고친다
function editForm(s, info, act) {
  act.hidden = true;
  const f = el("div", "form2"), inp = {};
  const fields = [["name", "f_name", "text", 60], ["event", "f_event", "text", 80], ["date", "f_date", "date", 0],
    ["sculptor", "f_sculptor", "text", 80], ["link", "f_link", "url", 300], ["memo", "f_memo", "textarea", 500]];
  for (const [k, lab, type, max] of fields) {
    const l = el("label", k == "name" || k == "memo" ? "full" : ""), i = el(type == "textarea" ? "textarea" : "input");
    if (type != "textarea") i.type = type;
    if (max) i.maxLength = max;
    i.value = s[k] || "";
    if (k == "event") i.setAttribute("list", "dl-event");
    if (k == "sculptor") i.setAttribute("list", "dl-sculptor");
    l.append(el("span", "", t(lab)), i);
    f.append(l);
    inp[k] = i;
  }
  const bar = el("div", "lactions");
  const ok = button(t("saveBtn"), () => {
    const patch = {};
    for (const k in inp) patch[k] = inp[k].value.trim();
    const c = cleanPal(Object.assign({}, s, patch), s.id);
    updatePalette(s, c);
    setMsg("lmsg", "updatedOk", c.name || "—");
  }, "primary");
  const no = button(t("cancel"), () => { f.remove(); bar.remove(); act.hidden = false });
  bar.append(ok, no);
  info.append(f, bar);
}
document.querySelectorAll("#lview button").forEach(b => { b.onclick = () => { LVIEW = b.dataset.v; renderLibrary() } });
$("lq").oninput = renderLibrary;
$("lpart").onchange = renderLibrary;
$("levent").onchange = renderLibrary;

// ---- 기록 열기 / 저장 ----
// 열기: 사진 축소본과 색을 팔레트로 불러오고, 저장 양식에 출처 정보를 채운다. 저장할 때 덮어쓸지 고를 수 있다
function setOpenRecord(s) {
  OPEN_ID = s ? s.id : null;
  $("ow-wrap").hidden = !s;
  $("m-overwrite").checked = !!s;
  owText();
}
function owText() {
  const s = SAVED.find(x => x.id == OPEN_ID);
  $("ow-text").textContent = s ? t("overwrite", s.name || "—") : "";
}
function fillMeta(s) {
  $("m-name").value = s ? s.name : "";
  for (const k of META) $("m-" + k).value = s ? s[k] || "" : "";
  if (!s) $("m-date").value = localDate();
}
function openSaved(s) {
  const apply = () => {
    PAL = s.colors.map(c => Object.assign({hex: c.hex, rgb: c.rgb.slice(), mix: c.mix.slice()}, c.part ? {part: c.part, tone: c.tone} : {}));
    $("mark").hidden = true;
    setMsg("hint", "hintLoaded", s.name);
    fillMeta(s);
    setOpenRecord(s);
    palChanged();
    show("palette");
    scrollTo(0, 0);
  };
  if (!s.thumb) { apply(); return }
  const img = new Image();
  img.onload = () => {
    cv.width = img.width;
    cv.height = img.height;
    ctx.drawImage(img, 0, 0);
    captureOrig();
    apply();
  };
  img.onerror = apply;
  img.src = s.thumb;
}
fillMeta(null);

// 사진은 불러온 해상도(최대 2400px) 그대로 품질 90%로 둔다. 너무 크면(base64 150만 자 초과) 0.75배씩 줄인다
function photoThumb() {
  const tc = document.createElement("canvas");
  let w = THUMB_MAX, url;
  do {
    tc.width = Math.min(w, cv.width);
    tc.height = Math.max(1, Math.round(tc.width * cv.height / cv.width));
    tc.getContext("2d").drawImage(cv, 0, 0, tc.width, tc.height);
    url = tc.toDataURL("image/jpeg", THUMB_Q);
    w = Math.round(w * .75);
  } while (url.length > THUMB_LIMIT && w > 100);
  return url;
}
$("palsave").onclick = () => {
  if (!PAL.length) { setMsg("savemsg", "exEmpty"); return }
  const meta = {name: $("m-name").value.trim() || t("tabPal") + " " + localDate()};
  for (const k of META) meta[k] = $("m-" + k).value.trim();
  const colors = PAL.map(p => Object.assign({hex: p.hex, rgb: p.rgb, mix: mixOf(p.rgb)}, p.part ? {part: p.part, tone: p.tone} : {}));
  const thumb = photoThumb();
  const target = OPEN_ID && $("m-overwrite").checked ? SAVED.find(x => x.id == OPEN_ID) : null;
  if (target) {
    updatePalette(target, cleanPal(Object.assign({}, target, meta, {colors, thumb}), target.id));
    setMsg("savemsg", "updatedOk", meta.name);
  } else {
    addPalette(cleanPal(Object.assign({}, meta, {created: Date.now(), colors, thumb}), ""));
    setMsg("savemsg", "savedOk", meta.name);
    for (const k of ["name", "sculptor", "link", "memo"]) $("m-" + k).value = "";
  }
};

// ---- 인쇄용 A4 PDF ----
// 150dpi 캔버스(1240×1754)에 그려 쪽 그림으로 넣는다 (한글·일본어 글꼴 문제 없이 인쇄되도록)
function bestRecipe(rgb) {
  const P = mixPaints();
  if (!P.length) return "";
  const r = bestMixes(rgb, P)[0];
  if (!r) return "";
  const g = r.parts.reduce(gcd);
  return r.idx.map((pi, i) => (brand == "mix" ? BSHORT[P[pi].brand] + " " : "") + P[pi].no + " " + r.parts[i] / g).join(" : ");
}
const loadImg = src => new Promise(ok => {
  if (!src) return ok(null);
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => ok(null);
  i.src = src;
});
async function buildLibraryPages(list, part, photo) {
  const W = 1240, H = 1754, M = 64, RH = 330, HEAD = 180, FOOT = 60;
  const rows = [];
  for (const s of list) for (const g of setsOf(s, part)) rows.push({s, g});
  const imgs = new Map();
  if (photo) for (const s of list) imgs.set(s.id, await loadImg(s.thumb));
  const per = Math.max(1, Math.floor((H - HEAD - FOOT) / RH)), total = Math.ceil(rows.length / per), pages = [];
  const sans = '"IBM Plex Sans KR","IBM Plex Sans JP",system-ui,sans-serif', mono = '"IBM Plex Mono",Menlo,Consolas,monospace';
  const ev = $("levent").value, pt = $("lpart").value;
  for (let pi = 0; pi < total; pi++) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.textBaseline = "alphabetic";
    // 머리: 제목, 날짜·필터·브랜드·기준 원색
    g.fillStyle = "#111";
    g.font = `600 34px ${sans}`;
    g.fillText(t("pdfTitle"), M, M + 30);
    g.font = `400 18px ${sans}`;
    g.fillStyle = "#555";
    g.fillText([localDate(), pt == "all" ? t("allParts") : t("part_" + pt), ev == "all" ? t("allEvents") : ev, bname(brand), "CMYKW: " + t("basis_" + BASIS)].join("  ·  "), M, M + 64);
    g.fillRect(M, HEAD - 36, W - 2 * M, 2);
    rows.slice(pi * per, pi * per + per).forEach(({s, g: set}, ri) => {
      const y = HEAD + ri * RH, top = y + 44, SH = 250;
      let x = M;
      g.fillStyle = "#111";
      g.font = `600 22px ${sans}`;
      g.fillText([set.part ? t("part_" + set.part) : t("single"), s.name || "—"].join("  ·  "), M, y + 4);
      g.font = `400 16px ${sans}`;
      g.fillStyle = "#555";
      g.fillText([s.event, s.date, s.sculptor].filter(Boolean).join("  ·  "), M, y + 28);
      // 사진: 200px 폭 칸을 채우도록 가운데를 잘라 넣는다
      if (photo) {
        const bw = 200, im = imgs.get(s.id);
        if (im) {
          const sc = Math.max(bw / im.width, SH / im.height), sw = bw / sc, sh = SH / sc;
          g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, top, bw, SH);
        } else {
          g.strokeStyle = "#ccc";
          g.strokeRect(x, top, bw, SH);
        }
        x += bw + 16;
      }
      // 색 칸: 명암 이름, HEX, C·M·Y·K·W, 가장 가까운 배합
      const keys = TONES.filter(k => set.tones[k]), sw = Math.floor((W - M - x - (keys.length - 1) * 16) / Math.max(keys.length, 3));
      keys.forEach((k, i) => {
        const cc = set.tones[k], sx = x + i * (sw + 16);
        g.fillStyle = cc.hex;
        g.fillRect(sx, top, sw, SH);
        g.strokeStyle = "#ddd";
        g.strokeRect(sx + .5, top + .5, sw - 1, SH - 1);
        g.fillStyle = isLight(cc.rgb) ? "#111" : "#fff";
        g.font = `600 18px ${sans}`;
        g.fillText(set.part ? t("tone_" + k) : "", sx + 12, top + 28);
        g.font = `500 17px ${mono}`;
        g.fillText(cc.hex, sx + 12, top + SH - 62);
        const m = mixOf(cc.rgb);
        g.fillText(PRIM.map((q, j) => q[0] + m[j]).join(" "), sx + 12, top + SH - 38);
        const rc = bestRecipe(cc.rgb);
        if (rc) {
          g.font = `500 15px ${mono}`;
          g.fillText(rc, sx + 12, top + SH - 14, sw - 24);
        }
      });
      g.fillStyle = "#e2e2e2";
      g.fillRect(M, y + RH - 22, W - 2 * M, 1);
    });
    // 쪽 번호
    g.fillStyle = "#777";
    g.font = `400 16px ${sans}`;
    g.textAlign = "right";
    g.fillText((pi + 1) + " / " + total, W - M, H - 30);
    g.textAlign = "left";
    pages.push(c);
  }
  return pages;
}
$("lpdf").onclick = async () => {
  const list = libFilter(), part = $("lpart").value;
  if (!list.some(s => setsOf(s, part).length)) { setMsg("lmsg", "libPdfEmpty"); return }
  setMsg("lmsg", "libPdfBusy");
  $("lpdf").disabled = true;
  try {
    const pages = await buildLibraryPages(list, part, $("lphoto").checked);
    await savePdf("colormix_library_" + localDate() + ".pdf", pages.map(c => canvasPage(c, A4[0], A4[1], .92)));
    setMsg("lmsg", "exSaved", "PDF");
  } catch (e) {
    setMsg("lmsg", e && e.code == "declined" ? "exDeclined" : "exFail");
  }
  $("lpdf").disabled = false;
};
