import json
import os
import re

import pytest

import storage


def test_missing_file_reads_as_none(tmp_path):
    assert storage.load_text(tmp_path / "colormix_data.json") is None


def test_save_then_load(tmp_path):
    path = tmp_path / "colormix_data.json"
    at = storage.save_text(path, '{"paints": ["가이아"]}')
    assert re.fullmatch(r"\d\d:\d\d", at)
    assert json.loads(storage.load_text(path)) == {"paints": ["가이아"]}
    # 임시 파일이 남지 않는다
    assert [p.name for p in tmp_path.iterdir()] == ["colormix_data.json"]


def test_load_ignores_utf8_bom(tmp_path):
    path = tmp_path / "colormix_data.json"
    path.write_bytes(b"\xef\xbb\xbf{}")
    assert storage.load_text(path) == "{}"


def test_invalid_json_is_not_written(tmp_path):
    path = tmp_path / "colormix_data.json"
    path.write_text('{"ok": 1}', encoding="utf-8")
    with pytest.raises(ValueError):
        storage.save_text(path, "{broken")
    assert path.read_text(encoding="utf-8") == '{"ok": 1}'


def test_broken_file_is_kept_before_overwrite(tmp_path):
    path = tmp_path / "colormix_data.json"
    path.write_text("{손상된 내용", encoding="utf-8")
    storage.save_text(path, "{}")
    kept = [p for p in os.listdir(tmp_path) if p.startswith("colormix_data.broken-")]
    assert len(kept) == 1
    assert (tmp_path / kept[0]).read_text(encoding="utf-8") == "{손상된 내용"
    assert path.read_text(encoding="utf-8") == "{}"
