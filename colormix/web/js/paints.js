// 도료 목록: 기본 도료(data/paints.json), 사용자가 고친 목록(PAINTS), 이름 표시, 정렬, 견본 칠하기.

// 브랜드 표시 순서. aq는 수성 도료 (락카·에나멜과 섞지 않는다)
const BORDER = ["tamiya", "tamiya_lp", "mr", "gaia", "fin", "mk", "aq"];
// "브랜드 혼합"에 넣는 락카 계열. 에나멜(tamiya)·수성(aq)은 넣지 않는다
const LACQUER = ["tamiya_lp", "mr", "gaia", "fin", "mk"];
const BSHORT = {tamiya: "X", tamiya_lp: "LP", mr: "Mr", gaia: "Gaia", fin: "Fin", mk: "MK", aq: "Aq"};

// 종류: normal 일반, clear 클리어(colorless면 무색), metallic 메탈릭·펄. 광택: gloss 유광, semi 반광, matte 무광
const TYPES = ["normal", "clear", "metallic"], FINISHES = ["gloss", "semi", "matte"], OPACITIES = ["transparent", "semi", "opaque"];
// 예전 버전의 종류 값 → [종류, 무색, 광택]
const OLDTYPES = {
  opaque: ["normal", 0], semi: ["normal", 0], tclear: ["clear", 0],
  clear_gloss: ["clear", 1, "gloss"], clear_semi: ["clear", 1, "semi"], clear_matte: ["clear", 1, "matte"],
};

let DEFAULTS = [];   // 기본 도료
let PN = {};         // "브랜드|번호" → [한국어, English, 日本語] 화면 이름
let OLDHEX = {};     // "브랜드|번호" → 예전 버전의 기본 색상값들
let PAINTS = [];     // 지금 쓰는 도료 목록 (데이터 파일에 저장되는 것)

const pkey = p => p.brand + "|" + p.no;
const isClear = p => p.type == "clear" && p.colorless;

// paints.json을 받아 기본 도료 목록과 이름표를 만든다
function setDefaults(json) {
  DEFAULTS = json.paints.map(p => ({
    brand: p.brand, no: p.no, name: p.name, hex: p.hex, own: !!p.own,
    type: p.type || "normal", colorless: !!p.colorless, finish: p.finish || "gloss", custom: false,
  }));
  PN = {};
  OLDHEX = {};
  for (const p of json.paints) {
    if (p.names) PN[pkey(p)] = p.names;
    if (p.old_hex) OLDHEX[pkey(p)] = p.old_hex;
  }
  DEFHEX = null;
}

// 불러온 목록이 이 프로그램의 도료 목록인지
const validPaints = s => Array.isArray(s) && s.length > 0 && s.length <= 2000 && s.every(p =>
  p && BORDER.includes(p.brand) && typeof p.no == "string" && typeof p.name == "string" &&
  /^#[0-9a-f]{6}$/i.test(p.hex) && (p.type == null || TYPES.includes(p.type) || p.type in OLDTYPES));

const HEX6 = /^#[0-9a-f]{6}$/i;
const numIn = (v, lo, hi) => typeof v == "number" && isFinite(v) && v >= lo && v <= hi ? v : null;

// 도료 목록을 저장 형식으로 정리한다 (빠진 칸은 기본값, 예전 종류 값은 새 값으로)
function norm(list) {
  return list.map(p => {
    const o = OLDTYPES[p.type] || [TYPES.includes(p.type) ? p.type : "normal", p.colorless ? 1 : 0];
    const type = o[0], colorless = type == "clear" && !!o[1];
    const finish = o[2] || (FINISHES.includes(p.finish) ? p.finish : "gloss");
    return {
      brand: p.brand, no: p.no.slice(0, 40), name: p.name.slice(0, 80),
      hex: colorless ? "#ffffff" : p.hex.toLowerCase(),
      type, colorless, finish, own: !!p.own, custom: !!p.custom, renamed: !!p.renamed,
      // 측정해서 넣는 값. 없으면 null(미측정)
      opacity: OPACITIES.includes(p.opacity) ? p.opacity : null,
      tinting_strength: numIn(p.tinting_strength, 0.01, 1000),
      hue_deg: numIn(p.hue_deg, 0, 360),
      // 사진에서 등록한 마지막 측정의 조건과, 되돌리기용 이전 색상값
      measured: normMeas(p.measured),
      hex_prev: HEX6.test(p.hex_prev) ? p.hex_prev.toLowerCase() : null,
    };
  });
}
function normMeas(m) {
  if (!m || typeof m != "object" || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return null;
  return {
    date: m.date,
    wb: ["white", "gray"].includes(m.wb) ? m.wb : null,
    size: [1, 5, 11].includes(m.size) ? m.size : null,
    spread: numIn(m.spread, 0, 1000),
    clip: !!m.clip,
    note: String(m.note == null ? "" : m.note).slice(0, 120),
  };
}

// 저장된 목록을 지금 버전의 기본 목록과 맞춘다
// - 예전 기본 색상값을 사용자가 바꾸지 않았다면 새 기본값으로 바꾼다
// - 기본값이 메탈릭이면 종류를 메탈릭으로 바꾼다
// - 기본 목록에서 빠진 도료는 보유 체크도 없고 직접 추가한 것도 아니면 정리한다
// - 저장된 목록에 없는 기본 도료(나중에 추가된 것)를 덧붙인다
function mergeDefaults(list) {
  const D = new Map(norm(DEFAULTS).map(d => [pkey(d), d])), have = new Set();
  for (const p of list) {
    const k = pkey(p), d = D.get(k);
    have.add(k);
    if (!d || p.custom) continue;
    if (OLDHEX[k] && OLDHEX[k].includes(p.hex)) p.hex = d.hex;
    if (d.type == "metallic" && p.type == "normal") p.type = "metallic";
  }
  list = list.filter(p => p.custom || p.own || D.has(pkey(p)));
  return list.concat([...D.values()].filter(d => !have.has(pkey(d))));
}

// 기본 색상값 ("기본값으로" 되돌리기용). 직접 추가한 도료는 없다
let DEFHEX = null;
function defHex(p) {
  if (!DEFHEX) DEFHEX = new Map(norm(DEFAULTS).map(d => [pkey(d), d.hex]));
  return p.custom ? null : DEFHEX.get(pkey(p)) || null;
}

// ---- 이름 ----
const bname = b => t("brand_" + b);
// 화면 언어의 이름. 직접 추가했거나 이름을 바꾼 도료는 적은 이름 그대로
const pname = p => {
  const n = PN[pkey(p)];
  return n && !p.custom && !p.renamed ? n[LI] : p.name;
};
// 번호 칸에 영어 이름이 들어간 도료(Finisher's 등)인지
const noIsName = p => {
  const en = (PN[pkey(p)] || [])[1];
  return en ? en.toLowerCase() == p.no.toLowerCase() : /\s/.test(p.no) && !/\d/.test(p.no);
};
// 목록에 쓰는 이름: "C1 화이트". 번호가 영어 이름이면 영어 화면에서는 한 번만, 한/일 화면에서는 "Foundation White (파운데이션 화이트)"
const plabel = p => {
  const n = pname(p);
  if (n.toLowerCase() == p.no.toLowerCase()) return p.no;
  return noIsName(p) ? p.no + " (" + n + ")" : p.no + " " + n;
};
// 검색: 화면 언어와 상관없이 번호와 한/영/일 이름 모두에서 찾는다
const paintMatch = (p, q) => !q || [p.no, p.name, pname(p), ...(PN[pkey(p)] || [])].join(" ").toLowerCase().includes(q);

const typeName = p => (isClear(p) ? t("clearColorless") : t("type_" + p.type)) + " · " + t("fin_" + p.finish) + (p.opacity ? " · " + t("op_" + p.opacity) : "");
// 색상각: 측정값(hue_deg)이 있으면 그것, 없으면 색상값에서 계산. 무색 클리어는 없음
const hueText = p => isClear(p) ? "—"
  : p.hue_deg != null ? `${Math.round(p.hue_deg)}° (${t("hueMeasured")})`
  : `${Math.round(rgb2hsv(hex2rgb(p.hex))[0])}° (${t("hueFromHex")})`;

// ---- 정렬 ----
const byNo = (a, b) => a.no.localeCompare(b.no, undefined, {numeric: true, sensitivity: "base"});
const byBrand = (a, b) => BORDER.indexOf(a.brand) - BORDER.indexOf(b.brand);
// 색상별: 무채색(채도 8 미만)을 밝은 순으로 먼저, 그다음 색상각 순·밝은 순, 무색 클리어는 맨 뒤
function colorKey(p) {
  if (isClear(p)) return [2, FINISHES.indexOf(p.finish), 0];
  const l = hex2lab(p.hex), c = Math.hypot(l[1], l[2]);
  return c < 8 ? [0, -l[0], 0] : [1, (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360, -l[0]];
}
const SORTS = {
  brand: (a, b) => byBrand(a, b) || byNo(a, b),
  no: (a, b) => byNo(a, b) || byBrand(a, b),
  color: (a, b) => {
    const x = colorKey(a), y = colorKey(b);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  },
};

// ---- 견본 ----
// 무색 클리어는 체크무늬, 색 있는 클리어는 체크무늬 위에 반투명 색
function paintSwatch(e, p) {
  e.classList.remove("checker");
  e.style.background = "";
  if (isClear(p)) {
    e.classList.add("checker");
    return;
  }
  if (p.type == "clear") {
    const c = hex2rgb(p.hex);
    e.classList.add("checker");
    e.style.backgroundImage = `linear-gradient(rgba(${c},.78),rgba(${c},.78)),repeating-conic-gradient(var(--line) 0 25%,var(--panel) 0 50%)`;
    e.style.backgroundSize = "auto,10px 10px";
    return;
  }
  e.style.background = p.hex;
}

// 사진에서 색상값을 등록한 도료의 "실측 10/22" 배지. 마우스를 올리면 측정 조건
function measBadge(p) {
  const m = p.measured;
  if (!m) return null;
  const b = el("span", "mbadge", t("regBadge", m.date.slice(5).replace("-", "/")));
  b.title = [
    m.date,
    m.wb ? t("regCondWb_" + m.wb) : t("regWarnNoWb"),
    m.size ? t("regCondSize", m.size + "×" + m.size) : "",
    m.spread != null ? t("regCondSpread", m.spread) : "",
    m.note,
  ].filter(Boolean).join("\n");
  return b;
}
