// 도움말: 탭마다 (i) 버튼을 두고, 누르면 그 탭의 도움말을 지금 언어로 보여 준다.
// 내용은 data/help.json: {탭: {ko|en|ja: [제목, [[소제목, [항목…]]…]]}}. 항목 안의 **굵게** 표기를 쓴다.

let HELP = {}, HELP_OPEN = null;

function showHelp(tab) {
  HELP_OPEN = tab;
  const h = HELP[tab][LANGS[LI]] || HELP[tab].ko, body = $("helpbody");
  $("helptitle").textContent = h[0];
  body.textContent = "";
  for (const [head, items] of h[1]) {
    body.append(el("h3", "", head));
    const ul = el("ul");
    for (const it of items) {
      const li = el("li");
      richText(li, it);
      ul.append(li);
    }
    body.append(ul);
  }
  $("helpdlg").hidden = false;
  $("helpdlg").querySelector(".helpbox").scrollTop = 0;
  $("helpclose").focus();
}
function closeHelp() {
  if (HELP_OPEN == null) return;
  const tab = HELP_OPEN;
  HELP_OPEN = null;
  $("helpdlg").hidden = true;
  const b = document.querySelector(`button.help[data-tab="${tab}"]`);
  if (b) b.focus();
}
$("helpclose").onclick = closeHelp;
$("helpdlg").addEventListener("click", e => { if (e.target === $("helpdlg")) closeHelp() });

// (i) 버튼을 놓을 곳: 줄(.bar/.lbar) 안이면 오른쪽 끝, 제목(h2)이면 그 앞에 오른쪽으로 띄운다
const HELP_SPOTS = [
  ["main", "#tab-main .side section h2"], ["palette", "#tab-palette .side section h2"], ["library", "#tab-library .lbar"],
  ["owned", "#tab-owned .bar"], ["paints", "#tab-paints > h2"], ["data", "#tab-data > h2"],
];
for (const [tab, sel] of HELP_SPOTS) {
  const target = document.querySelector(sel), b = button("i", () => showHelp(tab), "help");
  b.dataset.tab = tab;
  b.dataset.i18nAria = "help";
  b.dataset.i18nTitle = "help";
  if (target.tagName == "H2") { b.classList.add("fl"); target.before(b) }
  else target.append(b);
}
