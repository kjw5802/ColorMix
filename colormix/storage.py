"""데이터 파일(colormix_data.json) 읽기·쓰기.

쓰기는 임시 파일에 쓴 뒤 바꿔치기해서, 저장 도중 꺼져도 원래 파일이 깨지지 않게 한다.
"""

import json
import os
import shutil
import tempfile
from datetime import datetime


def load_text(path):
    """파일 내용(문자열). 파일이 없으면 None."""
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def save_text(path, json_text):
    """JSON 문자열을 path에 저장하고 저장 시각("HH:MM")을 돌려준다.

    - JSON으로 읽히지 않는 내용은 쓰지 않는다(ValueError).
    - 기존 파일이 손상되어 읽히지 않으면 덮어쓰기 전에 colormix_data.broken-날짜.json으로 남겨 둔다.
    """
    json.loads(json_text)
    folder = os.path.dirname(os.path.abspath(path))
    if os.path.exists(path) and not _is_json_file(path):
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        base = os.path.splitext(os.path.basename(path))[0]
        shutil.copy2(path, os.path.join(folder, f"{base}.broken-{stamp}.json"))
    fd, tmp = tempfile.mkstemp(prefix=".colormix_data.", suffix=".tmp", dir=folder)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(json_text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return datetime.now().strftime("%H:%M")


def _is_json_file(path):
    try:
        with open(path, encoding="utf-8-sig") as f:
            json.load(f)
        return True
    except (ValueError, OSError):
        return False
