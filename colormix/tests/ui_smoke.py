"""화면 전체를 실제로 띄워서 주요 동작을 확인하는 점검 스크립트.

    python tests/ui_smoke.py

pywebview 창이 잠깐 떴다가 닫힌다. 데이터 파일은 임시 폴더에 만들므로 실제 colormix_data.json은 건드리지 않는다.
마지막 줄의 RESULT가 "n / n"이면 모두 통과다.
"""

import json
import os
import sys
import tempfile
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import app  # noqa: E402
import webview  # noqa: E402

TMP = tempfile.mkdtemp(prefix="cm_ui_")
app.DATA_PATH = os.path.join(TMP, "colormix_data.json")
app.data_dir = lambda: TMP

R = []


def check(name, ok, detail=""):
    R.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + ("  | " + str(detail) if detail else ""), flush=True)


def wait_for(js, expr, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if js(expr):
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


def run(window, api):
    js = window.evaluate_js
    # 저장 대화상자 대신 임시 폴더의 정해진 파일 이름을 돌려준다
    window.create_file_dialog = lambda kind, **k: os.path.join(TMP, k.get("save_filename", "out"))
    wait_for(js, "typeof boot=='function' && document.getElementById('filestat').textContent")
    time.sleep(1.5)
    try:
        check("데이터 JSON 읽음", js("[Object.keys(T).length>200, DEFAULTS.length, Object.keys(HELP).length]") == [True, 466, 6],
              js("[Object.keys(T).length, DEFAULTS.length, Object.keys(HELP).length]"))
        check("예시 이미지에서 색을 찍음", js("$('hex').textContent").startswith("#"), js("$('hex').textContent"))
        check("배합 제안 3개", js("$('recs').children.length") == 3)
        check("IBM Plex Mono 글꼴", js("document.fonts.check('500 12px \"IBM Plex Mono\"')"))
        check("문구 키가 그대로 보이는 곳 없음", js("[...document.querySelectorAll('[data-i18n]')].every(e=>e.textContent!=e.dataset.i18n)"))

        # 흰 카드 기준 보정
        r = js("""(()=>{const x=cv.width-50,y=cv.height-45;setRefMode('white');setReference(x,y);$('size').value='5';pick(x,y);
                   return $('hex').textContent+' '+$('corrmsg').textContent})()""")
        rgb = [int(r[i:i + 2], 16) for i in (1, 3, 5)]
        check("흰색 기준 보정 → 약 #F0F0F0 무채색", max(rgb) - min(rgb) <= 3 and all(abs(v - 240) <= 4 for v in rgb), r)

        # 보유 120종에서 배합 계산 시간
        ms = js("""(()=>{const old=JSON.stringify(PAINTS);PAINTS.filter(p=>p.brand=='mr'&&!isClear(p)).slice(0,120).forEach(p=>p.own=true);
            const P=PAINTS.filter(p=>p.brand=='mr'&&p.own&&!isClear(p));const t0=performance.now();recipes([200,150,120],P);const d=performance.now()-t0;
            PAINTS=JSON.parse(old);return [P.length,d]})()""")
        check("보유 120종 배합 계산 1초 미만", ms[0] >= 120 and ms[1] < 1000, ms)

        # 브랜드 혼합은 한 브랜드만 쓴 것보다 나빠지지 않는다
        worse = js("""(()=>{const oldB=brand,old=JSON.stringify(PAINTS);PAINTS.forEach(p=>{if(LACQUER.includes(p.brand)&&!isClear(p)&&p.type!='metallic')p.own=true});
            let bad=0;for(let i=0;i<20;i++){const c=[(i*53)%256,(i*97)%256,(i*151)%256];brand='mix';const m=bestMixes(c,mixPaints())[0].de;
              for(const b of LACQUER){brand=b;const P=mixPaints();if(P.length&&bestMixes(c,P)[0].de<m-1e-9)bad++}}
            brand=oldB;PAINTS=JSON.parse(old);return bad})()""")
        check("브랜드 혼합 ≤ 각 브랜드 최선", worse == 0, worse)

        # 변경 → 저장 안 됨, Python에도 알림
        js("show('paints');document.querySelector('#rows input[type=checkbox]').click()")
        time.sleep(0.5)
        check("보유 체크 → 저장 안 됨", "저장 안 됨" in js("$('filestat').textContent") and api._dirty)

        # Ctrl+S
        js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true}))")
        time.sleep(1)
        check("Ctrl+S 저장", os.path.exists(app.DATA_PATH) and "저장됨" in js("$('filestat').textContent") and not api._dirty)
        d = json.load(open(app.DATA_PATH, encoding="utf-8"))
        check("파일 형식 v3", d.get("app") == "josaek-spoid" and d.get("version") == 3 and len(d["paints"]) == 466
              and set(d["settings"]) == {"lang", "sort", "size", "brand", "basis", "nometal", "setopen"},
              (len(d["paints"]), d["settings"]))

        # 팔레트 + 명암 세트 + 라이브러리 저장
        js("show('main');$('addpal').click();SET={hl:[250,220,200],base:[240,190,170],sh:[200,140,120]};renderSet();$('setadd').click();"
           "show('palette');$('m-name').value='테스트 작품';$('m-event').value='원더페스티벌';$('palsave').click()")
        time.sleep(1)
        check("라이브러리 저장", js("SAVED.length") == 1 and js("PAL.length") == 4, js("$('savemsg').textContent"))
        check("배합비 합 100%", js("PAL[1].mix.length==5 && Math.abs(PAL[1].mix.reduce((a,b)=>a+b,0)-100)<0.5"), js("JSON.stringify(PAL[1].mix)"))
        check("명암 관계 문장 2줄", js("$('rel').children.length") == 2, js("$('rel').textContent"))

        # PDF (Python이 만든다), PNG
        js("exportAs('pdf')")
        wait_for(js, "$('exmsg').textContent.includes('PDF')")
        pdf = os.path.join(TMP, "color-palette.pdf")
        head = open(pdf, "rb").read() if os.path.exists(pdf) else b""
        check("팔레트 PDF", head.startswith(b"%PDF") and head.count(b"/Type /Page ") == 1, (len(head), js("$('exmsg').textContent")))
        js("exportAs('png')")
        wait_for(js, "$('exmsg').textContent.includes('PNG')")
        png = os.path.join(TMP, "color-palette.png")
        check("팔레트 PNG", os.path.exists(png) and open(png, "rb").read(4) == b"\x89PNG")
        js("show('library');$('lpdf').click()")
        wait_for(js, "!$('lpdf').disabled && $('lmsg').textContent.includes('PDF')")
        lib = [f for f in os.listdir(TMP) if f.startswith("colormix_library_")]
        body = open(os.path.join(TMP, lib[0]), "rb").read() if lib else b""
        check("라이브러리 A4 PDF", body.startswith(b"%PDF") and b"/MediaBox [0 0 595.28 841.89]" in body, (lib, js("$('lmsg').textContent")))

        # 언어 전환
        js("LI=LANGS.indexOf('en');markDirty();applyLang()")
        en = js("document.querySelector('h1').textContent+'|'+$('navpal').textContent+'|'+$('filestat').textContent")
        js("LI=LANGS.indexOf('ja');markDirty();applyLang()")
        ja = js("document.querySelector('h1').textContent+'|'+document.documentElement.lang")
        check("영어", en.startswith("Paint Mix Eyedropper|Palette (4)"), en)
        check("일본어", ja == "調色スポイト|ja", ja)
        js("LI=LANGS.indexOf('ko');markDirty();applyLang()")

        # 도움말
        js("document.querySelector('button.help[data-tab=paints]').click()")
        check("도움말 창", not js("$('helpdlg').hidden") and js("$('helptitle').textContent") == "도료 관리 도움말")
        js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
        check("Esc로 도움말 닫기", js("$('helpdlg').hidden"))

        # 좁은 창
        window.resize(800, 900)
        time.sleep(1)
        js("show('palette')")
        lay = js("[innerWidth,document.documentElement.scrollWidth,getComputedStyle($('tab-palette')).gridTemplateColumns.split(' ').length]")
        check("820px 이하 한 단, 가로 스크롤 없음", lay[0] <= 820 and lay[1] <= lay[0] and lay[2] == 1, lay)
        window.resize(1320, 900)

        # 창 닫기(X) 가로채기
        check("닫기 전 저장 안 됨 상태", api._dirty)
        threading.Thread(target=window.destroy, daemon=True).start()
        time.sleep(1.5)
        check("닫기 → 종료 확인 창", js("!$('exitdlg').hidden") and "저장하지 않은" in js("$('exitbody').textContent"))
        js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
        check("Esc로 취소", js("$('exitdlg').hidden"))
        js("$('fexit').click()")
        time.sleep(0.3)
        js("$('exsave').click()")
        time.sleep(2)
    except Exception as e:
        check("예외", False, repr(e))
        api._allow_close = True
        window.destroy()


holder = {}
orig_create, orig_start = webview.create_window, webview.start


def create(*a, **k):
    holder["w"] = orig_create(*a, **k)
    holder["api"] = k["js_api"]
    return holder["w"]


webview.create_window = create
webview.start = lambda **k: orig_start(run, (holder["w"], holder["api"]), **k)
app.main()
d = json.load(open(app.DATA_PATH, encoding="utf-8"))
check("저장하고 나가기 → 라이브러리 기록됨", len(d["palettes"]) == 1 and d["palettes"][0]["name"] == "테스트 작품", len(d["palettes"]))
print("RESULT", sum(R), "/", len(R))
