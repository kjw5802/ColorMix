// 스포이드 화면 왼쪽: 사진 불러오기, 색 찍기, 조명 보정, 확대·축소.

const cv = $("cv"), ctx = cv.getContext("2d", {willReadFrequently: true});
let picked = null;     // 찍은 색 [R,G,B] (평균이라 소수일 수 있다)
let LASTPICK = null;   // 마지막으로 사진에서 찍은 조건 (도료 색상값 등록 때 보여 준다)
const SPREAD_WARN = 4; // 측정 편차(ΔE)가 이보다 크면 경고

// 마우스 위치 → 사진 픽셀 좌표
function pos(e) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) * cv.width / r.width);
  const y = Math.floor((e.clientY - r.top) * cv.height / r.height);
  return [Math.min(cv.width - 1, Math.max(0, x)), Math.min(cv.height - 1, Math.max(0, y))];
}

// (x, y)를 가운데로 한 (2k+1)×(2k+1) 칸의 픽셀
function pixelsAround(x, y, k) {
  const x0 = Math.max(0, x - k), y0 = Math.max(0, y - k);
  const w = Math.min(cv.width, x + k + 1) - x0, h = Math.min(cv.height, y + k + 1) - y0;
  return ctx.getImageData(x0, y0, w, h).data;
}
function sample(x, y, k) {
  const d = pixelsAround(x, y, k), s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2] }
  return s.map(v => v / (d.length / 4));
}
// 측정 범위 안의 색 편차: 각 픽셀의 Lab이 평균 Lab에서 떨어진 거리(ΔE76)의 평균. 반사광·질감·경계가 섞이면 커진다
function sampleSpread(x, y, k) {
  if (!k) return 0;
  const d = pixelsAround(x, y, k), L = [];
  for (let i = 0; i < d.length; i += 4) L.push(rgbLab([d[i], d[i + 1], d[i + 2]]));
  const m = [0, 1, 2].map(j => L.reduce((s, l) => s + l[j], 0) / L.length);
  return L.reduce((s, l) => s + deltaE(l, m), 0) / L.length;
}

function placeMark(id, x, y) {
  const m = $(id);
  m.hidden = false;
  m.style.left = (x + .5) / cv.width * 100 + "%";
  m.style.top = (y + .5) / cv.height * 100 + "%";
}

function pick(x, y) {
  const k = +$("size").value;
  picked = sample(x, y, k);
  placeMark("mark", x, y);
  $("mark").dataset.x = x;
  $("mark").dataset.y = y;
  const clip = origMax(x, y, k) >= 250, sp = sampleSpread(x, y, k);
  setMsg("clipwarn", clip ? "clipWarn" : null);
  setMsg("spreadwarn", sp > SPREAD_WARN ? "spreadWarn" : null, sp.toFixed(1));
  LASTPICK = {
    wb: CORR && !$("showorig").checked ? CORR.kind : null,
    size: k * 2 + 1,
    spread: k ? Math.round(sp * 10) / 10 : null,
    clip,
  };
  render();
}

// 사진이 아닌 곳(팔레트, 최근 색)의 색을 찍은 색으로 올린다
function showColor(rgb) {
  picked = rgb.slice();
  $("mark").hidden = true;
  setMsg("clipwarn");
  setMsg("spreadwarn");
  LASTPICK = null;
  render();
}

// ---- 조명 보정 ----
// ORIG: 불러온 사진의 원본 픽셀. 보정은 선형 RGB에서 채널별 배율(폰 크리스 방식)로 적용한다.
let ORIG = null, CORR = null, refMode = null;
const WHITE_T = toLin(240);   // 흰색 기준을 맞출 목표 밝기 (sRGB 240 ≈ 흰 서페이서)

function captureOrig() {
  ORIG = ctx.getImageData(0, 0, cv.width, cv.height);
  CORR = null;
  setZoom(null);
  $("showorig").checked = false;
  $("refmark").hidden = true;
  $("corroff").disabled = true;
  setRefMode(null);
  setMsg("corrmsg", "corrNone");
  setMsg("clipwarn");
  setMsg("spreadwarn");
  LASTPICK = null;
}
// 원본에서 (x, y) 주변의 위치를 차례로 넘겨준다
function eachOrig(x, y, k, fn) {
  const W = ORIG.width, d = ORIG.data;
  for (let j = Math.max(0, y - k); j <= Math.min(ORIG.height - 1, y + k); j++)
    for (let i = Math.max(0, x - k); i <= Math.min(W - 1, x + k); i++) fn(d, (j * W + i) * 4);
}
// 원본에서 가장 밝은 채널 값 (250 이상이면 하얗게 날아간 것)
function origMax(x, y, k) {
  if (!ORIG) return 0;
  let m = 0;
  eachOrig(x, y, k, (d, o) => { m = Math.max(m, d[o], d[o + 1], d[o + 2]) });
  return m;
}
function origLinAvg(x, y, k) {
  const s = [0, 0, 0];
  let n = 0;
  eachOrig(x, y, k, (d, o) => { s[0] += toLin(d[o]); s[1] += toLin(d[o + 1]); s[2] += toLin(d[o + 2]); n++ });
  return s.map(v => v / n);
}

function drawImageState() {
  if (!ORIG) return;
  if (!CORR || $("showorig").checked) {
    ctx.putImageData(ORIG, 0, 0);
  } else {
    // 채널마다 0~255 → 보정값 표를 만들어 픽셀에 적용한다
    const lut = CORR.gains.map(g => {
      const a = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) a[v] = Math.round(toS(Math.min(1, toLin(v) * g)));
      return a;
    });
    const out = new ImageData(new Uint8ClampedArray(ORIG.data), ORIG.width, ORIG.height), d = out.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[0][d[i]]; d[i + 1] = lut[1][d[i + 1]]; d[i + 2] = lut[2][d[i + 2]] }
    ctx.putImageData(out, 0, 0);
  }
  const m = $("mark");
  if (!m.hidden) pick(+m.dataset.x, +m.dataset.y);
  corrStatus();
}
function corrStatus() {
  if (!CORR) { setMsg("corrmsg", "corrNone"); return }
  if ($("showorig").checked) { setMsg("corrmsg", "corrShowingOrig"); return }
  const g = CORR.gains.map(v => v.toFixed(2));
  setMsg("corrmsg", CORR.kind == "white" ? "corrWhite" : "corrGray", g[0], g[1], g[2]);
}
function setRefMode(m) {
  refMode = m;
  $("refwhite").setAttribute("aria-pressed", m == "white");
  $("refgray").setAttribute("aria-pressed", m == "gray");
  $("stage").classList.toggle("picking", !!m);
  if (m) setMsg("corrmsg", m == "white" ? "refPromptWhite" : "refPromptGray");
  else if (ORIG) corrStatus();
}
// 기준으로 찍은 곳: 날아갔거나(250 이상), 너무 어둡거나, 색이 너무 강하면(채널 비 4배 초과) 쓰지 않는다
function setReference(x, y) {
  const kind = refMode;
  setRefMode(null);
  if (origMax(x, y, 5) >= 250) { setMsg("corrmsg", "refClipped"); return }
  const r = origLinAvg(x, y, 5), Y = .2126 * r[0] + .7152 * r[1] + .0722 * r[2];
  if (Y < .01 || Math.min(...r) < .002) { setMsg("corrmsg", "refDark"); return }
  if (Math.max(...r) / Math.min(...r) > 4) { setMsg("corrmsg", "refColored"); return }
  // 흰색 기준은 색 치우침과 밝기, 회색 기준은 색 치우침만 고친다
  const target = kind == "white" ? WHITE_T : Y;
  CORR = {kind, gains: r.map(c => Math.min(6, Math.max(.2, target / c))), x, y};
  placeMark("refmark", x, y);
  $("corroff").disabled = false;
  $("showorig").checked = false;
  drawImageState();
}
$("refwhite").onclick = () => setRefMode(refMode == "white" ? null : "white");
$("refgray").onclick = () => setRefMode(refMode == "gray" ? null : "gray");
$("corroff").onclick = () => {
  CORR = null;
  $("refmark").hidden = true;
  $("corroff").disabled = true;
  $("showorig").checked = false;
  drawImageState();
};
$("showorig").onchange = drawImageState;

// ---- 확대·축소 ----
// ZOOM: 사진 픽셀 대비 배율. null이면 창에 맞춤. 휠은 커서 위치를 중심으로 확대하고, 확대한 상태에서 끌면 이동한다(짧게 누르면 색 찍기).
const vp = $("vp"), ZMAX = 16, ZSTEP = 1.25;
let ZOOM = null;
function fitScale() {
  const w = vp.clientWidth || cv.width, h = innerHeight * .72;
  return Math.min(1, w / cv.width, h / cv.height);
}
const curScale = () => ZOOM == null ? fitScale() : ZOOM;
function applyZoom() {
  const s = curScale();
  cv.style.width = Math.floor(cv.width * s) + "px";
  cv.style.height = Math.floor(cv.height * s) + "px";
  vp.classList.toggle("px", s >= 2);   // 200% 이상이면 픽셀을 또렷하게
  $("zoomval").textContent = Math.round(s * 100) + "%";
  $("zoomout").disabled = ZOOM == null;
  $("zoomin").disabled = s >= ZMAX - 1e-6;
  $("zoomfit").disabled = ZOOM == null;
}
// (cx, cy) 화면 위치에 있던 사진 지점이 확대 뒤에도 같은 자리에 오도록 스크롤한다. 없으면 보이는 영역 가운데 기준
function setZoom(z, cx, cy) {
  const r0 = cv.getBoundingClientRect(), vr = vp.getBoundingClientRect();
  if (cx == null) { cx = vr.left + vr.width / 2; cy = vr.top + vr.height / 2 }
  const s0 = curScale(), fx = (cx - r0.left) / s0, fy = (cy - r0.top) / s0;
  if (z != null) {
    z = Math.min(ZMAX, z);
    if (z <= fitScale() + 1e-6) z = null;
  }
  ZOOM = z;
  applyZoom();
  const s = curScale(), r = cv.getBoundingClientRect();
  vp.scrollLeft += r.left + fx * s - cx;
  vp.scrollTop += r.top + fy * s - cy;
}
$("zoomin").onclick = () => setZoom(curScale() * ZSTEP);
$("zoomout").onclick = () => setZoom(curScale() / ZSTEP);
$("zoomfit").onclick = () => setZoom(null);
$("zoom100").onclick = () => setZoom(1);
vp.addEventListener("wheel", e => {
  e.preventDefault();
  setZoom(curScale() * (e.deltaY < 0 ? ZSTEP : 1 / ZSTEP), e.clientX, e.clientY);
}, {passive: false});

// 오른쪽 칸 높이: 지금 보이는 위치부터 창 아래까지. 페이지를 내리면 위에 붙고(sticky) 창 높이만큼 늘어난다
function fitSide() {
  const s = document.querySelector("#tab-main .side");
  if (innerWidth <= 820 || $("tab-main").hidden) { s.style.maxHeight = ""; return }
  s.style.maxHeight = Math.max(240, innerHeight - Math.max(16, s.getBoundingClientRect().top) - 16) + "px";
}
addEventListener("resize", () => { if (!$("tab-main").hidden) { applyZoom(); fitSide() } });
addEventListener("scroll", () => { if (!$("tab-main").hidden) fitSide() }, {passive: true});

// ---- 마우스: 끌어서 이동, 클릭해서 찍기 ----
let drag = null, dragged = false;
cv.addEventListener("pointerdown", e => {
  dragged = false;
  const canScroll = vp.scrollWidth > vp.clientWidth || vp.scrollHeight > vp.clientHeight;
  if (e.button > 1 || !canScroll) return;
  drag = {x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop, id: e.pointerId};
});
cv.addEventListener("mousedown", e => { if (e.button == 1) e.preventDefault() });
const endDrag = () => { drag = null; vp.classList.remove("panning") };
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("pointermove", e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) > 4) {
      dragged = true;
      try { cv.setPointerCapture(drag.id) } catch (x) {}
      vp.classList.add("panning");
    }
    if (dragged) {
      vp.scrollLeft = drag.sl - dx;
      vp.scrollTop = drag.st - dy;
      return;
    }
  }
  const [x, y] = pos(e);
  $("hov").style.background = rgb2hex(sample(x, y, 0));
});
// 클릭: 기준 찍기 중이면 기준, 도료 등록 중이면 확인 창, 명암 세트 칸을 골랐으면 그 칸에 넣는다
cv.addEventListener("click", e => {
  if (dragged) { dragged = false; return }
  const [x, y] = pos(e);
  if (refMode) { setReference(x, y); return }
  pick(x, y);
  if (REG) { regConfirm(); return }
  fillSlot();
});
$("size").onchange = () => {
  markDirty();
  const m = $("mark");
  if (!m.hidden) pick(+m.dataset.x, +m.dataset.y);
};

// ---- 사진 불러오기 ----
// 긴 변 2400px보다 크면 줄여서 연다. 새 사진을 열면 팔레트를 비운다
function load(file) {
  if (!file || !file.type.startsWith("image/")) { setMsg("hint", "errType"); return }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const s = Math.min(1, 2400 / Math.max(img.width, img.height));
    cv.width = Math.round(img.width * s);
    cv.height = Math.round(img.height * s);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    $("mark").hidden = true;
    captureOrig();
    setOpenRecord(null);
    const had = PAL.length;
    PAL = [];
    palChanged();
    setMsg("hint", had ? "hintLoadedCleared" : "hintLoaded", file.name);
    show("main");
  };
  img.onerror = () => setMsg("hint", "errOpen");
  img.src = url;
}
$("file").onchange = e => load(e.target.files[0]);
const stage = $("stage");
stage.addEventListener("dragover", e => { e.preventDefault(); stage.classList.add("drag") });
stage.addEventListener("dragleave", () => stage.classList.remove("drag"));
stage.addEventListener("drop", e => { e.preventDefault(); stage.classList.remove("drag"); load(e.dataTransfer.files[0]) });
addEventListener("paste", e => {
  const f = [...(e.clipboardData?.files || [])][0];
  if (f) load(f);
});

// 처음 화면의 예시 이미지: 따뜻한 조명 아래에서 찍은 것처럼 색을 치우치게 하고, 오른쪽 아래에 흰 설명 카드를 둔다
function drawSample() {
  const cols = ["#5b6236", "#8aa6b8", "#8c4a2f", "#c9b48a", "#3f4447", "#a3262c"], w = cv.width / 3, h = cv.height / 2;
  cols.forEach((c, i) => {
    const x = (i % 3) * w, y = Math.floor(i / 3) * h;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,255,255,.18)");
    g.addColorStop(1, "rgba(0,0,0,.22)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });
  ctx.fillStyle = "#f4f4f2";
  ctx.fillRect(cv.width - 170, cv.height - 110, 140, 80);
  ctx.fillStyle = "#555";
  ctx.fillRect(cv.width - 150, cv.height - 90, 90, 6);
  ctx.fillRect(cv.width - 150, cv.height - 74, 60, 6);
  const im = ctx.getImageData(0, 0, cv.width, cv.height), d = im.data, cast = [1.0, .86, .66];
  for (let i = 0; i < d.length; i += 4)
    for (let c = 0; c < 3; c++) d[i + c] = Math.round(toS(toLin(d[i + c]) * cast[c] * .92));
  ctx.putImageData(im, 0, 0);
  captureOrig();
  pick(Math.round(w / 2), Math.round(h / 2));
}
