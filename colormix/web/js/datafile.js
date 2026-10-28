// 데이터 파일과 Python 쪽 기능 (window.pywebview.api).
// 도료 목록·라이브러리·화면 설정은 exe와 같은 폴더의 colormix_data.json에 저장한다.
// 바뀌면 "저장 안 됨"으로 표시하고, 저장 버튼·Ctrl+S·종료 창에서 파일에 쓴다.

const API = () => window.pywebview.api;
// Python API가 준비되면 풀리는 약속 (main.js가 기다렸다가 데이터 파일을 읽는다)
const API_READY = new Promise(ok => {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.load_data) ok();
  else addEventListener("pywebviewready", ok, {once: true});
});
const DATANAME = "colormix_data.json";
let FILE_EXISTS = false, DIRTY = false, LOADING = false;

// 창 닫기(X)를 가로챌지 Python이 판단할 수 있도록 바뀔 때마다 알린다
function setDirty(v) {
  DIRTY = v;
  try { if (window.pywebview && window.pywebview.api) API().set_dirty(v) } catch (e) {}
}
function markDirty() {
  if (LOADING) return;
  if (!DIRTY) setDirty(true);
  fileStatus();
}
function fileStatus() {
  const st = $("filestat");
  st.textContent = FILE_EXISTS || DIRTY ? t(DIRTY ? "fsDirty" : "fsSaved", DATANAME) : t("fsNone");
  st.classList.toggle("dirty", DIRTY);
}

// 파일 형식 (version 3): {app, version, paints, settings, palettes}
function buildData() {
  return {
    app: "josaek-spoid", version: 3,
    paints: norm(PAINTS),
    settings: {lang: LANGS[LI], sort: $("sort").value, size: $("size").value, brand, basis: BASIS, nometal: NOMETAL, setopen: SETOPEN},
    palettes: SAVED.map(palBody),
  };
}

// 파일 내용을 적용한다. replace=true(시작할 때 데이터 파일): 라이브러리를 통째로 바꾸고 화면 설정도 읽는다.
// replace=false(백업 불러오기): 도료 목록만 바꾸고 라이브러리는 없는 기록만 더한다. 화면 설정은 그대로. 더한 기록 수를 돌려준다
function applyData(o, replace) {
  const list = Array.isArray(o) ? o : o && o.paints;
  if (!validPaints(list)) throw new Error("bad");
  LOADING = true;
  try {
    PAINTS = mergeDefaults(norm(list));
    if (replace) applySettings(o.settings || {});
    const pals = Array.isArray(o.palettes) ? o.palettes : [];
    let n = 0;
    if (replace) {
      SAVED = pals.slice(0, 2000).map((x, i) => cleanPal(x, "f" + i)).filter(x => x.colors.length);
      n = SAVED.length;
    } else {
      const have = new Set(SAVED.map(x => x.name + "|" + x.created));
      for (const raw of pals.slice(0, 500)) {
        const c = cleanPal(raw, "");
        if (!c.colors.length || have.has(c.name + "|" + c.created)) continue;
        addPalette(palBody(c));
        have.add(c.name + "|" + c.created);
        n++;
      }
    }
    applyLang();
    return n;
  } finally {
    LOADING = false;
  }
}
function applySettings(st) {
  if (LANGS.includes(st.lang)) LI = LANGS.indexOf(st.lang);
  if (SORTS[st.sort]) $("sort").value = st.sort;
  if (["0", "2", "5"].includes(st.size)) $("size").value = st.size;
  if (BORDER.includes(st.brand) || st.brand == "mix") brand = st.brand;
  if (st.basis in BASES) BASIS = st.basis;
  if (typeof st.nometal == "boolean") { NOMETAL = st.nometal; $("nometal").checked = NOMETAL }
  if (typeof st.setopen == "boolean") { SETOPEN = st.setopen; $("setbox").open = SETOPEN }
}

async function saveToFile() {
  try {
    const at = await API().save_data(JSON.stringify(buildData()));
    FILE_EXISTS = true;
    setDirty(false);
    fileStatus();
    setMsg("filemsg", "fsSavedAt", at);
    return true;
  } catch (e) {
    setMsg("filemsg", "fsError");
    return false;
  }
}
$("fsave").onclick = $("fsave2").onclick = () => saveToFile();

// 시작: 데이터 파일이 있으면 읽어 들인다. 없으면 기본 상태로 시작하고 첫 저장 때 만든다
async function boot() {
  try { $("filepath").textContent = await API().data_path() } catch (e) {}
  let txt = null;
  try { txt = await API().load_data() } catch (e) { setMsg("filemsg", "fsReadError") }
  if (txt != null) {
    FILE_EXISTS = true;
    if (txt.trim()) {
      try {
        const n = applyData(JSON.parse(txt), true);
        setMsg("filemsg", "fsLoaded", DATANAME, PAINTS.length, n);
      } catch (e) {
        setMsg("filemsg", "fsReadError");
      }
    }
  }
  setDirty(false);
  fileStatus();
}

// ---- 다른 이름으로 저장 / 백업 데이터 불러오기 ----
// 다른 이름으로 저장은 사본만 만든다(도료 목록과 라이브러리, 화면 설정은 빼고). 프로그램이 여는 파일과 "저장 안 됨" 상태는 그대로
$("backsave").onclick = async () => {
  const d = buildData();
  delete d.settings;
  try {
    await saveFile("colormix_preset_" + localDate() + ".json", JSON.stringify(d, null, 1));
    setMsg("filemsg", "backupSaved");
  } catch (e) {
    setMsg("filemsg", e && e.code == "declined" ? "exDeclined" : "exFail");
  }
};
$("backfile").onclick = async () => {
  let f;
  try { f = await API().open_json_dialog() } catch (x) { setMsg("filemsg", "backupBad"); return }
  if (!f) return;
  try {
    const n = applyData(JSON.parse(f.text), false);
    markDirty();
    setMsg("filemsg", "backupOk", PAINTS.length, n);
  } catch (x) {
    setMsg("filemsg", "backupBad");
  }
};

// ---- 저장 대화상자로 파일 저장 (PNG, JSON, PDF) ----
// 취소하면 {code: "declined"}를 던져 "저장을 취소했습니다"가 나오게 한다
const toB64 = data => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] || "");
  r.onerror = () => no(r.error);
  r.readAsDataURL(data instanceof Blob ? data : new Blob([data]));
});
async function saveFile(filename, data) {
  const path = await API().save_file_dialog(filename, await toB64(data));
  if (!path) throw {code: "declined"};
}
// PDF는 Python이 만든다. 쪽마다 캔버스를 JPEG로 넘기고 쪽 크기(pt)를 함께 준다
const A4 = [595.28, 841.89];
const canvasPage = (canvas, w, h, quality) => ({jpeg: canvas.toDataURL("image/jpeg", quality).split(",")[1], w, h});
async function savePdf(filename, pages) {
  const path = await API().save_pdf_dialog(filename, pages);
  if (!path) throw {code: "declined"};
}

// ---- 종료 확인 창 ----
// 창의 X 버튼은 Python이 가로채 showExitDialog()를 부른다
function showExitDialog() {
  $("exitbody").textContent = t(DIRTY ? "exitBody" : "exitBodyClean");
  setMsg("exitmsg");
  $("exitdlg").hidden = false;
  $("exsave").focus();
}
function closeExitDialog() {
  $("exitdlg").hidden = true;
  $("fexit").focus();
}
$("fexit").onclick = showExitDialog;
$("excancel").onclick = closeExitDialog;
$("exsave").onclick = async () => {
  if (await saveToFile()) API().exit_app(true);
  else setMsg("exitmsg", "fsError");
};
$("exnosave").onclick = () => API().exit_app(false);
