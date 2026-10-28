// 팔레트: 찍어 모은 색, 각 색의 C·M·Y·K·W 배합비, PNG·PDF 내보내기, 최근 추가한 색.

// C·M·Y·K·W 비율의 기준 원색. generic은 가상의 원색(근사값), 나머지는 도료 관리에 있는 실제 제품의 색상값을 쓴다
const PRIM = [["C", "#00a0dc"], ["M", "#d6007a"], ["Y", "#fae100"], ["K", "#141414"], ["W", "#f7f7f7"]];
const BASES = {
  generic: null,
  mr: [["mr", "CR1"], ["mr", "CR2"], ["mr", "CR3"], ["mr", "C2"], ["mr", "C1"]],
  gaia: [["gaia", "033"], ["gaia", "034"], ["gaia", "035"], ["gaia", "002"], ["gaia", "001"]],
};
let BASIS = "generic";

function primHexes() {
  const B = BASES[BASIS];
  return PRIM.map((q, i) => {
    if (!B) return q[1];
    const p = PAINTS.find(x => x.brand == B[i][0] && x.no == B[i][1]);
    return p ? p.hex : q[1];
  });
}
// 배합비 계산은 무거우므로 (원색, 색) 조합마다 한 번만 한다
const MIXCACHE = new Map();
function mixOf(rgb) {
  const hexes = primHexes(), key = hexes.join() + "|" + rgb.map(Math.round).join();
  if (!MIXCACHE.has(key)) MIXCACHE.set(key, cmykw(rgb, hexes.map(paintK)));
  return MIXCACHE.get(key);
}
const basisMap = () => {
  const B = BASES[BASIS];
  return B ? PRIM.map((q, i) => q[0] + "=" + B[i][1]).join("  ") : "";
};
function basisOptions() {
  fillOptions($("basis"), Object.keys(BASES), k => t("basis_" + k));
  $("basis").value = BASIS;
  $("basismap").textContent = basisMap();
}
$("basis").onchange = () => {
  BASIS = $("basis").value;
  markDirty();
  $("basismap").textContent = basisMap();
  renderPalette();
};

// PAL: 팔레트의 색 {rgb, hex, mix, seq(추가 순번), part·tone(명암 세트일 때)}
let PAL = [], ADDSEQ = 0;
const palLabel = p => p.part && p.tone ? t("part_" + p.part) + " · " + t("tone_" + p.tone) : "";

function palChanged() {
  $("navpal").textContent = PAL.length ? t("palN", PAL.length) : t("tabPal");
  if (!$("tab-palette").hidden) renderPalette();
  renderRecent();
}

// 최근 추가한 색: 추가한 순서의 역순으로 작은 칸에 보여 준다. 누르면 그 색을 다시 찍은 색으로 올린다
function renderRecent() {
  const box = $("recentsw");
  box.textContent = "";
  $("recent").hidden = !PAL.length;
  for (const p of PAL.slice().sort((a, b) => (b.seq || 0) - (a.seq || 0))) {
    const b = button("", () => showColor(p.rgb));
    b.style.background = p.hex;
    b.title = p.hex + (palLabel(p) ? " · " + palLabel(p) : "");
    b.setAttribute("aria-label", b.title);
    box.append(b);
  }
}

$("addpal").onclick = () => {
  if (!picked) return;
  const hex = rgb2hex(picked);
  if (PAL.some(p => p.hex == hex)) { setMsg("addmsg", "dupPal", hex); return }
  PAL.push({rgb: picked.map(Math.round), hex, mix: mixOf(picked), seq: ++ADDSEQ});
  setMsg("addmsg", "added", hex, PAL.length);
  palChanged();
};
$("palclear").onclick = () => { PAL = []; palChanged() };

// 왼쪽 큰 그림(사진 위 + 색 칸 아래)과 오른쪽 목록
function renderPalette() {
  drawPaletteImage();
  const box = $("pallist"), n = PAL.length;
  box.textContent = "";
  if (!n) box.append(el("p", "note", t("palEmpty")));
  PAL.forEach((p, i) => {
    const row = el("div", "prow"), chip = el("span", "chip");
    chip.style.background = p.hex;
    const m = mixOf(p.rgb), split = mixSplitText(m);
    const info = (palLabel(p) ? palLabel(p) + " · " : "") + `${p.hex} · ` + mixText(m) + (split ? " · " + split : "");
    const act = (text, label, fn, disabled) => {
      const b = button(text, fn);
      b.setAttribute("aria-label", p.hex + " " + label);
      b.disabled = !!disabled;
      return b;
    };
    const move = d => () => { PAL.splice(i + d, 0, PAL.splice(i, 1)[0]); palChanged() };
    row.append(
      chip,
      el("span", "mono", info),
      act(t("viewMix"), t("viewMix"), () => { showColor(p.rgb); show("main"); scrollTo(0, 0) }),
      act("◀", t("fwd"), move(-1), i == 0),
      act("▶", t("back"), move(1), i == n - 1),
      act(t("del"), t("del"), () => { PAL.splice(i, 1); palChanged() }),
    );
    box.append(row);
  });
}

// 1600px 폭: 위에 사진, 아래에 한 줄 최대 6칸의 색 견본(HEX, 명암 이름, C·M·Y·K·W)
function drawPaletteImage() {
  const pc = $("pal"), g = pc.getContext("2d"), W = 1600, M = 24, SH = 420, n = PAL.length;
  const per = Math.min(6, Math.max(n, 1)), rows = Math.ceil(n / per);
  const ph = Math.round(W * cv.height / cv.width), sw = (W - (per - 1) * M) / per;
  pc.width = W;
  pc.height = ph + rows * (SH + M);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, pc.width, pc.height);
  g.drawImage(cv, 0, 0, W, ph);
  const fs = per > 4 ? 26 : 30;
  const mono = `500 ${fs}px "IBM Plex Mono",Menlo,Consolas,monospace`;
  PAL.forEach((p, i) => {
    const x = (i % per) * (sw + M), y = ph + M + Math.floor(i / per) * (SH + M);
    g.fillStyle = p.hex;
    g.fillRect(x, y, sw, SH);
    g.fillStyle = isLight(p.rgb) ? "#111" : "#fff";
    g.font = mono;
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillText(p.hex, x + 18, y + 18 + fs);
    const lb = palLabel(p);
    if (lb) {
      g.font = `500 ${Math.round(fs * .8)}px "IBM Plex Sans KR","IBM Plex Sans JP",system-ui,sans-serif`;
      g.fillText(lb, x + 18, y + 18 + fs + Math.round(fs * 1.2));
      g.font = mono;
    }
    const mx = mixOf(p.rgb);
    g.textAlign = "right";
    PRIM.forEach((q, j) => g.fillText(`${q[0]} ${String(mx[j]).padStart(3, " ")}%`, x + sw - 18, y + SH - 18 - (4 - j) * (fs + 8)));
  });
}
// 글꼴을 다 읽은 뒤 다시 그린다 (캔버스 글자가 대체 글꼴로 그려지지 않도록)
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!$("tab-palette").hidden) renderPalette() });

// PNG: 그림 그대로. PDF: 그림 크기의 절반(pt)을 쪽 크기로 한 한 쪽짜리
async function exportAs(kind) {
  if (!PAL.length) { setMsg("exmsg", "exEmpty"); return }
  renderPalette();
  const pc = $("pal");
  let save;
  try {
    if (kind == "png") {
      const blob = await new Promise((ok, no) => pc.toBlob(b => b ? ok(b) : no(new Error("png")), "image/png"));
      save = () => saveFile("color-palette.png", blob);
    } else {
      const pages = [canvasPage(pc, pc.width / 2, pc.height / 2, .95)];
      save = () => savePdf("color-palette.pdf", pages);
    }
  } catch (e) {
    setMsg("exmsg", kind == "pdf" ? "exPdfFail" : "exImgFail");
    return;
  }
  try {
    await save();
    setMsg("exmsg", "exSaved", kind.toUpperCase());
  } catch (e) {
    setMsg("exmsg", e && e.code == "declined" ? "exDeclined" : "exFail");
  }
}
$("expng").onclick = () => exportAs("png");
$("expdf").onclick = () => exportAs("pdf");
