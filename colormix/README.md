# 조색 스포이드 (ColorMix) — Windows 버전

`colormix.html`을 pywebview 창에 띄워 Windows 프로그램으로 만든 것입니다. 화면, 계산식, 문구는 HTML 버전과 같습니다.

## 실행

```
pip install -r requirements.txt
python app.py
```

## exe 빌드

`build.bat`를 실행하면 `dist\ColorMix.exe` 하나가 만들어집니다(PyInstaller `--onefile --windowed`).

## 데이터

- 도료 목록, 설정, 라이브러리는 **exe(개발 중에는 app.py)와 같은 폴더의 `colormix_data.json`** 에 저장됩니다. 처음 실행할 때는 파일이 없어도 되고, 처음 저장할 때 만들어집니다.
- 형식은 백업 내보내기 파일(version 3)과 같아서, Claude 페이지와 서로 불러올 수 있습니다.
- 저장: 머리글의 **저장** 버튼, Ctrl+S, 종료 확인 창의 **저장하고 나가기**.
- 저장할 변경이 있을 때 창을 닫으면 **저장하고 나가기 / 저장하지 않고 나가기 / 취소** 창이 뜹니다.
- 기존 데이터 파일이 손상되어 읽히지 않으면, 덮어쓰기 전에 `colormix_data.broken-날짜.json`으로 따로 남겨 둡니다.

## 구성

| 경로 | 내용 |
|---|---|
| `app.py` | pywebview 진입점, Python API(`load_data`, `save_data`, `save_file_dialog`, `open_json_dialog`, `set_dirty`, `exit_app`, `data_path`) |
| `web/index.html` | `colormix.html`을 바탕으로 저장 계층만 바꾼 화면 |
| `web/vendor/` | jsPDF 2.5.1, IBM Plex Mono(로컬, 인터넷 없이 동작) |
| `data/paints_default.json` | 기본 도료 302종 (참고용, 같은 데이터가 index.html 안에도 있음) |

## HTML 버전과 다른 점

- 스포이드 화면에 사진 확대·축소를 추가했습니다(－ / ＋ / 맞춤 / 100% 버튼, 마우스 휠, 확대 중 드래그로 이동, 최대 1600%, 200% 이상에서 픽셀을 또렷하게 표시).

- localStorage, IndexedDB, Claude 전용 코드(`window.claude`, 계정 저장소, downloads)는 제거했습니다.
- PNG, PDF, 백업 JSON은 Windows 저장 대화상자로 저장하고, 백업 불러오기는 열기 대화상자를 씁니다.
- 데이터 탭은 버튼 세 개로 정리했습니다.
  - **저장**: `colormix_data.json`에 저장 (머리글의 저장, Ctrl+S와 같음)
  - **다른 이름으로 저장**: 도료 목록과 라이브러리만 원하는 위치에 사본으로 저장 (예전 "내보내기", 화면 설정은 담지 않음). 프로그램이 여는 파일은 그대로
  - **백업 데이터 불러오기**: 도료 목록은 파일 내용으로 바꾸고, 라이브러리는 없는 기록만 더함. 화면 설정(언어 등)은 바꾸지 않음
  - 화면 설정(언어, 정렬, 측정 범위, 배합 브랜드, 기준 원색)은 `colormix_data.json`에만 저장되고, 시작할 때만 읽습니다
- IBM Plex Sans KR/JP는 포함하지 않았고, 시스템 글꼴(맑은 고딕, Yu Gothic)로 표시됩니다. 숫자·코드용 IBM Plex Mono는 포함했습니다.

## 알려진 한계

- 배합 계산은 RGB 3채널 근사 모델이라 실제 도료와 차이가 있습니다. 항상 소량으로 시험 조색하세요.
- 도료 색상값은 카탈로그 인쇄 견본 변환값 또는 임시 근사값입니다.
- 견본 측정과 레이어 판정은 아직 구현하지 않았습니다.
- 서명되지 않은 exe라서 Windows **스마트 앱 컨트롤**이 켜진 PC에서는 실행이 차단될 수 있습니다. 이때는 `python app.py`로 실행하세요.
