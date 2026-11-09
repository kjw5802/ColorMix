import re

import make_version_info
from version import VERSION


def test_version_is_one_dot_build_count():
    assert re.fullmatch(r"1\.[1-9]\d*", VERSION)


def test_version_info_has_four_numbers():
    text = make_version_info.version_info("1.24")
    assert "filevers=(1, 24, 0, 0)" in text
    assert "StringStruct('FileVersion', '1.24')" in text
