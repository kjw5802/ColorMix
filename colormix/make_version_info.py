"""exe 속성(자세히 탭)에 들어갈 버전 정보 파일을 version.py 값으로 만든다. build.bat가 부른다."""

import os

from version import VERSION

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "version_info.txt")


def version_info(version):
    # 파일 속성의 숫자 버전은 항상 네 자리다
    numbers = tuple(int(n) for n in version.split(".")) + (0, 0)
    return f"""VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={numbers},
    prodvers={numbers},
    mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)
  ),
  kids=[
    StringFileInfo([StringTable('041204B0', [
      StringStruct('FileDescription', '조색 스포이드 (ColorMix)'),
      StringStruct('FileVersion', '{version}'),
      StringStruct('InternalName', 'ColorMix'),
      StringStruct('OriginalFilename', 'ColorMix.exe'),
      StringStruct('ProductName', '조색 스포이드 (ColorMix)'),
      StringStruct('ProductVersion', '{version}')
    ])]),
    VarFileInfo([VarStruct('Translation', [1042, 1200])])
  ]
)
"""


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(version_info(VERSION))
