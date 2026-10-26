@echo off
REM Startet die Gebetszeiten-Anzeige unter Windows (Python und Google Chrome muessen installiert sein).
cd /d "%~dp0"
start "Webserver Anzeige" /min py -m http.server 8080 --bind 127.0.0.1 || start "Webserver Anzeige" /min python -m http.server 8080 --bind 127.0.0.1
timeout /t 3 >nul
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
start "" "%CHROME%" --kiosk --user-data-dir="%LOCALAPPDATA%\moschee-anzeige-browser" --noerrdialogs --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required --disable-features=Translate http://localhost:8080/index.html
