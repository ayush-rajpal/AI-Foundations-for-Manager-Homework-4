@echo off
rem Backend venv lives at C:\venvs\hw4 (outside OneDrive to avoid Windows path-length issues).
rem dev.py runs uvicorn with auto-reload: edits to backend .py files or prompts\prompt.md restart it.
cd /d "%~dp0backend"
"C:\venvs\hw4\Scripts\python.exe" dev.py 8000
