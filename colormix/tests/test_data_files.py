"""web/data/의 JSON 파일과, 화면 코드가 쓰는 문구 키를 확인한다."""
import glob
import json
import os
import re

import pytest

WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
BRANDS = ["tamiya", "tamiya_lp", "mr", "gaia", "fin", "mk", "aq"]
HEX = re.compile(r"^#[0-9a-f]{6}$")


def load(name):
    with open(os.path.join(WEB, "data", name), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def strings():
    s = load("strings.json")
    assert s.pop("_order") == ["ko", "en", "ja"]
    return s


@pytest.fixture(scope="module")
def code():
    text = open(os.path.join(WEB, "index.html"), encoding="utf-8").read()
    for f in glob.glob(os.path.join(WEB, "js", "*.js")):
        text += open(f, encoding="utf-8").read()
    return text


def test_paints():
    paints = load("paints.json")["paints"]
    keys = [p["brand"] + "|" + p["no"] for p in paints]
    assert len(keys) == len(set(keys)), "같은 브랜드·번호가 두 번 있다"
    for p in paints:
        assert p["brand"] in BRANDS, p
        assert HEX.match(p["hex"]), p
        assert p.get("type", "normal") in ("normal", "clear", "metallic"), p
        assert p.get("finish", "gloss") in ("gloss", "semi", "matte"), p
        if p.get("colorless"):  # 무색은 클리어에만 (색상값은 불러올 때 #ffffff로 바뀐다)
            assert p.get("type") == "clear", p
        if "names" in p:
            assert len(p["names"]) == 3 and all(p["names"]), p
        for old in p.get("old_hex", []):
            assert HEX.match(old) and old != p["hex"], p


def test_strings_have_three_languages(strings):
    for k, v in strings.items():
        assert isinstance(v, list) and len(v) == 3 and all(isinstance(s, str) and s for s in v), k
        # {0}, {1} 자리 표시는 세 언어에 똑같이 있어야 한다
        marks = [sorted(set(re.findall(r"\{\d\}", s))) for s in v]
        assert marks[0] == marks[1] == marks[2], k


def test_every_key_used_in_code_exists(strings, code):
    used = set(re.findall(r'data-i18n(?:-ph|-aria|-title)?="([^"]+)"', code))
    # t("키") 와 setMsg("칸", "키"). t("brand_" + b)처럼 이어 붙이는 키는 test_brand_strings 등에서 따로 본다
    used |= set(re.findall(r'\bt\("([A-Za-z0-9_]+)"\s*[,)]', code))
    used |= set(re.findall(r'setMsg\("\w+",\s*"([A-Za-z0-9_]+)"\s*[,)]', code))
    missing = sorted(k for k in used if k not in strings)
    assert not missing, missing


def test_brand_strings(strings):
    for b in BRANDS + ["mix"]:
        assert "brand_" + b in strings and "note_" + b in strings, b


def test_help():
    h = load("help.json")
    assert set(h) == {"main", "palette", "library", "owned", "paints", "data"}
    for tab, langs in h.items():
        assert set(langs) == {"ko", "en", "ja"}, tab
        for lang, (title, sections) in langs.items():
            assert title and sections, (tab, lang)
            for head, items in sections:
                assert head and items and all(items), (tab, lang, head)
            # 굵게(**) 표시는 짝이 맞아야 한다
            for _, items in sections:
                for it in items:
                    assert it.count("**") % 2 == 0, (tab, lang, it)
