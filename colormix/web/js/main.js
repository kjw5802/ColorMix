// 시작과 화면 전환: 데이터(JSON)를 읽고, 탭을 바꾸고, 언어를 적용한다. 가장 마지막에 읽는 파일.

const TABS = ["main", "palette", "library", "owned", "paints", "data"];

// 탭 전환. 보이게 되는 탭만 다시 그린다
function show(tab) {
  if (!TABS.includes(tab)) tab = "main";
  TABS.forEach(x => { $("tab-" + x).hidden = x != tab });
  document.querySelectorAll("#nav button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab == tab));
  if (tab == "main") { applyZoom(); render(); fitSide() }
  if (tab == "palette") renderPalette();
  if (tab == "library") renderLibrary();
  if (tab == "owned") renderOwned();
  if (tab == "paints") renderPaints();
}
document.querySelectorAll("#nav button").forEach(b => { b.onclick = () => show(b.dataset.tab) });

// 지금 언어로 모든 글자를 다시 쓴다
function applyLang() {
  const lang = LANGS[LI];
  document.documentElement.lang = lang;
  // HTML에 data-i18n 표시가 붙은 글자들
  document.querySelectorAll("[data-i18n]").forEach(e => { e.textContent = e.dataset.arg ? t(e.dataset.i18n, e.dataset.arg) : t(e.dataset.i18n) });
  document.querySelectorAll("[data-i18n-ph]").forEach(e => { e.placeholder = t(e.dataset.i18nPh) });
  document.querySelectorAll("[data-i18n-aria]").forEach(e => { e.setAttribute("aria-label", t(e.dataset.i18nAria)) });
  document.querySelectorAll("[data-i18n-title]").forEach(e => { e.title = t(e.dataset.i18nTitle) });
  const lb = $("langbtn");
  lb.textContent = LANGNAME[lang];
  lb.lang = lang;
  lb.setAttribute("aria-label", t("lang") + ": " + LANGNAME[lang]);
  // 상태 문구
  for (const id in MSG) $(id).textContent = MSG[id] ? t(...MSG[id]) : "";
  // 코드가 만드는 목록·선택지
  brandOptions();
  basisOptions();
  partOptions();
  renderSet();
  seg();
  render();
  renderOwned();
  renderPaints();
  palChanged();
  renderLibrary();
  owText();
  fileStatus();
  regBanner();
  if (HELP_OPEN != null) showHelp(HELP_OPEN);
  if (CH) renderChooser();
  if (REG && !$("regconf").hidden) regConfirm();
}
// 언어 버튼 하나: 누를 때마다 English → 한국어 → 日本語 순서로 바뀐다. 버튼에는 지금 언어를 표시한다
const LANGCYCLE = ["en", "ko", "ja"];
$("langbtn").onclick = () => {
  LI = LANGS.indexOf(LANGCYCLE[(LANGCYCLE.indexOf(LANGS[LI]) + 1) % LANGCYCLE.length]);
  markDirty();
  applyLang();
};

// 키보드: Esc는 맨 위에 열린 창 하나를 닫는다, Ctrl+S는 저장
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "s") {
    e.preventDefault();
    saveToFile();
    return;
  }
  if (e.key != "Escape") return;
  if (!$("regconf").hidden) regEnd();
  else if (!$("regdlg").hidden) closeChooser();
  else if (HELP_OPEN != null) closeHelp();
  else if (!$("exitdlg").hidden) closeExitDialog();
  else if (refMode) setRefMode(null);
});

const readJson = name => fetch("data/" + name + ".json").then(r => {
  if (!r.ok) throw new Error(name + ".json " + r.status);
  return r.json();
});

async function start() {
  const [strings, paints, help] = await Promise.all(["strings", "paints", "help"].map(readJson));
  delete strings._order;
  T = strings;
  HELP = help;
  setDefaults(paints);
  PAINTS = norm(DEFAULTS);
  drawSample();
  applyLang();
  show(location.hash.slice(1));
  await API_READY;
  await boot();
}
start();
