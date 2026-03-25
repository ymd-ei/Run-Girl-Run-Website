@echo off
echo Starting portfolio server...
echo.

:: Check for Python
where python >nul 2>&1
if %errorlevel% == 0 (
    set PY=python
    goto run
)

where python3 >nul 2>&1
if %errorlevel% == 0 (
    set PY=python3
    goto run
)

echo Python not found.
echo Please install Python from https://python.org
echo.
pause
exit

:run
:: Open the browser (small delay so server starts first)
ping 127.0.0.1 -n 2 >nul
start http://localhost:8080

echo Server running at http://localhost:8080
echo Editor at   http://localhost:8080/editor.html
echo.
echo Press Ctrl+C to stop.
echo.

:: This line keeps the window open and runs the server
%PY% -m http.server 8080
pause
