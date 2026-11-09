@echo off
rem ColorMix (josaek spoid) - PyInstaller one-file build. Output: dist\ColorMix.exe
cd /d "%~dp0"

python -m pip install -r requirements.txt
if errorlevel 1 goto :fail

python make_version_info.py
if errorlevel 1 goto :fail

python -m PyInstaller --noconfirm --clean --onefile --windowed ^
  --name ColorMix ^
  --version-file build\version_info.txt ^
  --add-data "web;web" ^
  app.py
if errorlevel 1 goto :fail

echo.
echo Build complete: %~dp0dist\ColorMix.exe
echo colormix_data.json will be created next to the exe on first save.
exit /b 0

:fail
echo.
echo Build failed.
exit /b 1
