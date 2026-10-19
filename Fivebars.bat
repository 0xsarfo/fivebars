@echo off
rem Windows: double-click to start Fivebars from source (needs Python 3.9+ from python.org or the Microsoft Store).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 fivebars.py & goto :eof)
where python >nul 2>nul && (python fivebars.py & goto :eof)
echo Fivebars needs Python 3. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run this again.
pause
