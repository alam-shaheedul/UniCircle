@echo off
setlocal
set "backend_dir=%~dp0"
if not exist "%backend_dir%.venv\Scripts\python.exe" (
  echo Backend virtual environment not found. See backend\README.md for setup.
  exit /b 1
)
"%backend_dir%.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir "%backend_dir%" --reload --reload-dir "%backend_dir%app" --host 127.0.0.1 --port 8000
