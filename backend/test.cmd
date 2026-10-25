@echo off
setlocal
set "backend_dir=%~dp0"
if not exist "%backend_dir%.venv\Scripts\python.exe" (
  echo Backend virtual environment not found. See backend\README.md for setup.
  exit /b 1
)
pushd "%backend_dir%"
".venv\Scripts\python.exe" -m ruff check app tests scripts
if errorlevel 1 goto :failed
".venv\Scripts\python.exe" -m pytest -q --basetemp=.pytest-temp
if errorlevel 1 goto :failed
popd
exit /b 0

:failed
set "test_exit=%errorlevel%"
popd
exit /b %test_exit%
