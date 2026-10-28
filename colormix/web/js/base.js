// 공통 도구: DOM 도우미, 숫자·날짜 표기, 화면 문구(한국어·영어·일본어).
// 문구 자체는 data/strings.json에 있고, 시작할 때 main.js가 읽어 T에 넣는다.

const $ = id => document.getElementById(id);

// 요소 만들기: el("span", "클래스", "글자")
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(text, onclick, cls) {
  const b = el("button", cls || "", text);
  b.type = "button";
  if (onclick) b.onclick = onclick;
  return b;
}

// <select>를 다시 채운다. label(k)가 보이는 글자, 원래 고른 값은 남아 있으면 유지한다
function fillOptions(sel, keys, label, fallback) {
  const keep = sel.value;
  sel.textContent = "";
  for (const k of keys) {
    const o = el("option", "", label(k));
    o.value = k;
    sel.append(o);
  }
  sel.value = keys.includes(keep) ? keep : fallback != null ? fallback : keys[0];
}

const fmtN = v => String(Math.round(v * 10) / 10);
const pad2 = n => String(n).padStart(2, "0");
const localDate = () => {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
};

// ---- 언어 ----
const LANGS = ["ko", "en", "ja"];
const LANGNAME = {ko: "한국어", en: "English", ja: "日本語"};
let T = {};   // 문구 키 → [한국어, English, 日本語]
let LI = 0;   // 지금 언어 (LANGS의 순번)

// t("added", hex, n): 문구의 {0}, {1}… 자리에 값을 넣는다. 없는 키는 키 이름을 그대로 보여 준다
function t(key, ...args) {
  const v = T[key];
  let s = v ? v[LI] : key;
  args.forEach((x, i) => { s = s.replace("{" + i + "}", x) });
  return s;
}

// 상태 문구: 언어를 바꾸면 다시 써야 하므로 [키, 인자…]로 기억해 둔다 (null이면 비어 있음)
const MSG = {
  filemsg: null, exitmsg: null, lmsg: null, resetmsg: null, hint: ["hintSample"], corrmsg: ["corrNone"],
  clipwarn: null, addmsg: null, exmsg: null, savemsg: null, satbadge: null, spreadwarn: null, regmsg: null,
};
const HIDE_EMPTY = ["clipwarn", "satbadge", "spreadwarn"];   // 문구가 없으면 칸째 숨긴다

function setMsg(id, key, ...args) {
  MSG[id] = key ? [key, ...args] : null;
  const e = $(id);
  e.textContent = key ? t(key, ...args) : "";
  if (HIDE_EMPTY.includes(id)) e.hidden = !key;
}

// "**굵게**" 표기를 <b>로 바꿔 넣는다 (HTML로 해석하지 않고 글자 조각으로 넣는다)
function richText(parent, s) {
  s.split("**").forEach((part, i) => {
    if (part) parent.append(i % 2 ? el("b", "", part) : document.createTextNode(part));
  });
}
