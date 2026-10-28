# 조색 스포이드 (ColorMix) — Windows 버전

사진에서 색을 찍어 보유 도료로 만드는 배합을 제안하는 프로그램입니다. 화면은 웹 기술(HTML·CSS·JS)로 만들고 pywebview 창에 띄우며, 파일 저장·PDF 만들기 같은 일은 Python이 맡습니다. 인터넷 없이 동작합니다.

## 실행과 빌드

```
pip install -r requirements.txt
python app.py
```

`build.bat`를 실행하면 `dist\ColorMix.exe` 하나가 만들어집니다(PyInstaller `--onefile --windowed`). 빌드 전에 실행 중인 ColorMix를 닫아야 합니다.

## 점검

```
pip install -r requirements-dev.txt
python -m pytest tests          # Python 모듈과 데이터 파일 (몇 초)
python tests/ui_smoke.py        # 창을 실제로 띄워 주요 동작 확인 (약 30초, 마지막 줄 RESULT n / n)
```

## 파일 구성

| 경로 | 내용 |
|---|---|
| `app.py` | 진입점. 창을 띄우고, 화면의 JS가 부르는 Python API(`Api` 클래스)를 둔다 |
| `storage.py` | 데이터 파일 읽기·쓰기 (안전하게 바꿔치기 저장, 손상 파일 따로 보관) |
| `pdfmaker.py` | 쪽 그림(JPEG)들로 PDF 만들기 (외부 라이브러리 없음) |
| `web/index.html` | 화면 뼈대. 글자는 `data-i18n` 키로 채운다 |
| `web/css/app.css` | 화면 스타일 |
| `web/js/` | 화면 동작 (아래 표) |
| `web/data/paints.json` | 기본 도료 466종: 번호, 이름(한/영/일), 색상값, 종류·광택, 보유 기본값, 색상값 출처 |
| `web/data/strings.json` | 화면 문구. 키마다 [한국어, English, 日本語] |
| `web/data/help.json` | 탭별 도움말 |
| `web/vendor/` | IBM Plex Mono 글꼴 (로컬) |
| `tests/` | pytest 단위 테스트와 화면 점검 스크립트 |

### web/js/ (읽는 순서대로)

| 파일 | 맡는 일 |
|---|---|
| `base.js` | DOM 도우미, 문구 함수 `t()`, 상태 문구 `setMsg()` |
| `color.js` | 색 계산: sRGB·Lab 변환, ΔE, Kubelka-Munk 혼합, 배합 탐색 `recipes()`, C·M·Y·K·W 비율 `cmykw()`. 화면과 무관한 순수 함수 |
| `paints.js` | 도료 목록 모델: 기본 도료 읽기, 저장 형식 정리 `norm()`, 버전 맞추기 `mergeDefaults()`, 이름 표시, 정렬 |
| `eyedropper.js` | 스포이드 왼쪽: 사진 불러오기, 색 찍기, 조명 보정, 확대·축소 |
| `suggest.js` | 스포이드 오른쪽: 찍은 색 값, 배합 제안(브랜드 혼합 포함), 명암 세트 |
| `palette.js` | 팔레트, 기준 원색, 최근 추가한 색, PNG·PDF 내보내기 |
| `library.js` | 라이브러리 기록, 검색·필터, A4 PDF |
| `paintlist.js` | 보유 도료 탭, 도료 관리 탭 |
| `register.js` | 사진에서 도료 색상값 등록 (한 개 / 연속) |
| `datafile.js` | 데이터 파일 저장·불러오기, 백업, 종료 확인, Python API 호출 |
| `help.js` | 탭별 (i) 도움말 |
| `main.js` | 시작(데이터 JSON 읽기), 탭 전환, 언어 적용, 단축키 |

파일들은 모듈이 아닌 일반 스크립트라 서로의 함수·변수를 그대로 씁니다. 그래서 `index.html`의 `<script>` 순서가 중요합니다.

## 데이터

- 도료 목록, 라이브러리, 화면 설정은 **exe(개발 중에는 app.py)와 같은 폴더의 `colormix_data.json`** 에 저장됩니다. 처음 저장할 때 만들어지며, 개인 기록이라 git에는 넣지 않습니다.
- 저장: 머리글의 **저장**, Ctrl+S, 종료 확인 창의 **저장하고 나가기**. 저장할 변경이 있을 때 창을 닫으면 **저장하고 나가기 / 저장하지 않고 나가기 / 취소**를 묻습니다.
- **다른 이름으로 저장**은 도료 목록과 라이브러리만 담은 사본(화면 설정 제외), **백업 데이터 불러오기**는 도료 목록을 바꾸고 라이브러리는 없는 기록만 더합니다.
- 기존 데이터 파일이 손상되어 읽히지 않으면 덮어쓰기 전에 `colormix_data.broken-날짜.json`으로 남겨 둡니다.
- 기본 도료(`paints.json`)를 고쳐도 사용자가 바꾼 값은 유지됩니다. 예전 기본값을 그대로 쓰던 도료만 새 값으로 바뀝니다(`old_hex`).

## 알려진 한계

- 배합 계산은 RGB 3채널 근사 모델이라 실제 도료와 차이가 있습니다. 항상 소량으로 시험 조색하세요.
- 도료 색상값은 카탈로그 인쇄 견본 변환값 또는 임시 근사값입니다. 사진에서 색상값 등록으로 실측값으로 바꿀 수 있습니다.
- 서명되지 않은 exe라서 Windows **스마트 앱 컨트롤**이 켜진 PC에서는 실행이 차단될 수 있습니다. 이때는 `python app.py`로 실행하세요.
