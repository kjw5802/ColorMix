"""조색 스포이드 (ColorMix) - Windows 실행 파일 진입점.

화면은 web/index.html(원래 colormix.html)을 pywebview로 띄우고,
브라우저가 못 하는 일(데이터 파일 저장, 저장 대화상자, 종료 확인)만 Api 클래스로 처리한다.
"""

import base64
import json
import os
import shutil
import sys
import tempfile
import threading
from datetime import datetime

import webview

APP_TITLE = "조색 스포이드"
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
        self._dirty = False
        self._allow_close = False

    # ---- 데이터 파일 ----
    def data_path(self):
        return DATA_PATH

    def load_data(self):
        if not os.path.exists(DATA_PATH):
            return None
        with open(DATA_PATH, encoding="utf-8-sig") as f:
            return f.read()

    def save_data(self, json_text):
        json.loads(json_text)  # 깨진 내용은 쓰지 않는다
        # 기존 파일이 JSON으로 읽히지 않으면(손상 등) 덮어쓰기 전에 따로 남겨 둔다
        if os.path.exists(DATA_PATH):
            try:
                with open(DATA_PATH, encoding="utf-8-sig") as f:
                    json.load(f)
            except (ValueError, OSError):
                stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                shutil.copy2(DATA_PATH, os.path.join(data_dir(), f"colormix_data.broken-{stamp}.json"))
        # 임시 파일에 쓴 뒤 교체(원자적 저장)
        fd, tmp = tempfile.mkstemp(prefix=".colormix_data.", suffix=".tmp", dir=data_dir())
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
                f.write(json_text)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, DATA_PATH)
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        return datetime.now().strftime("%H:%M")

    # ---- 파일 대화상자 ----
    def save_file_dialog(self, suggested_name, data_base64):
        ext = os.path.splitext(suggested_name)[1].lower()
        types = (FILE_TYPES[ext],) if ext in FILE_TYPES else ()
        result = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            directory=data_dir(),
            save_filename=suggested_name,
            file_types=types,
        )
        if not result:
            return None
        path = result if isinstance(result, str) else result[0]
        if ext and not path.lower().endswith(ext):
            path += ext
        with open(path, "wb") as f:
            f.write(base64.b64decode(data_base64))
        return path

    def open_json_dialog(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            directory=data_dir(),
            file_types=(FILE_TYPES[".json"], "All files (*.*)"),
        )
        if not result:
            return None
        path = result[0]
        with open(path, encoding="utf-8-sig") as f:
            return {"name": os.path.basename(path), "text": f.read()}

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
