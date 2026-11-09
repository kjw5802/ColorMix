"""ColorMix - Windows 실행 파일 진입점.

화면(web/)을 pywebview 창에 띄우고, 브라우저가 못 하는 일만 Api 클래스로 처리한다:
데이터 파일 읽기·쓰기(storage.py), 저장·열기 대화상자, PDF 만들기(pdfmaker.py), 종료 확인.
화면의 JS는 window.pywebview.api.이름(...)으로 Api의 공개 메서드를 부른다(밑줄로 시작하는 것은 JS에 보이지 않는다).
"""

import base64
import os
import sys
import threading

import webview

import pdfmaker
import storage
from version import VERSION

APP_TITLE = f"ColorMix v{VERSION}"
DATA_NAME = "colormix_data.json"


def resource_dir():
    # PyInstaller 단일 파일에서는 리소스가 임시 폴더(sys._MEIPASS)에 풀린다
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def data_dir():
    # 데이터 파일은 exe(개발 중에는 app.py)가 있는 폴더에 둔다
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


DATA_PATH = os.path.join(data_dir(), DATA_NAME)

FILE_TYPES = {
    ".png": "PNG (*.png)",
    ".pdf": "PDF (*.pdf)",
    ".json": "JSON (*.json)",
}


class Api:
    def __init__(self):
        self._window = None
        self._dirty = False        # 저장 안 된 변경이 있는지 (JS가 set_dirty로 알려 준다)
        self._allow_close = False  # True면 창 닫기를 막지 않는다

    # ---- 데이터 파일 ----
    def data_path(self):
        return DATA_PATH

    def load_data(self):
        return storage.load_text(DATA_PATH)

    def save_data(self, json_text):
        return storage.save_text(DATA_PATH, json_text)

    # ---- 파일 대화상자 ----
    def save_file_dialog(self, suggested_name, data_base64):
        """저장 대화상자에서 고른 곳에 base64 내용을 쓴다. 취소하면 None."""
        return self._save_as(suggested_name, lambda: base64.b64decode(data_base64))

    def save_pdf_dialog(self, suggested_name, pages):
        """pages: [{"jpeg": base64, "w": pt, "h": pt}, ...]로 PDF를 만들어 저장한다. 취소하면 None."""
        return self._save_as(suggested_name, lambda: pdfmaker.build_pdf(
            [(base64.b64decode(p["jpeg"]), float(p["w"]), float(p["h"])) for p in pages]))

    def open_json_dialog(self):
        """열기 대화상자에서 고른 JSON 파일의 {"name", "text"}. 취소하면 None."""
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            directory=data_dir(),
            file_types=(FILE_TYPES[".json"], "All files (*.*)"),
        )
        if not result:
            return None
        path = result[0]
        return {"name": os.path.basename(path), "text": storage.load_text(path)}

    def _save_as(self, suggested_name, make_bytes):
        ext = os.path.splitext(suggested_name)[1].lower()
        result = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            directory=data_dir(),
            save_filename=suggested_name,
            file_types=(FILE_TYPES[ext],) if ext in FILE_TYPES else (),
        )
        if not result:
            return None
        path = result if isinstance(result, str) else result[0]
        if ext and not path.lower().endswith(ext):
            path += ext
        data = make_bytes()
        with open(path, "wb") as f:
            f.write(data)
        return path

    # ---- 종료 ----
    def set_dirty(self, value):
        self._dirty = bool(value)

    def exit_app(self, save):
        # 저장은 JS가 save_data로 먼저 끝낸 뒤 부른다
        self._allow_close = True
        self._window.destroy()


def on_closing(api):
    def handler():
        if api._allow_close or not api._dirty:
            return True
        # closing은 GUI 스레드에서 불리므로, 화면 안의 확인 창은 다른 스레드에서 띄운다
        threading.Thread(target=lambda: api._window.evaluate_js("showExitDialog()"), daemon=True).start()
        return False

    return handler


def main():
    api = Api()
    window = webview.create_window(
        APP_TITLE,
        os.path.join(resource_dir(), "web", "index.html"),
        js_api=api,
        width=1320,
        height=900,
        min_size=(480, 600),
        background_color="#ECECEC",
        text_select=True,
    )
    api._window = window
    window.events.closing += on_closing(api)
    webview.start(gui="edgechromium", http_server=True, private_mode=True)


if __name__ == "__main__":
    main()
