@echo off
title Onyx - Local AI Command Center
cd /d "%~dp0"

if not exist "node_modules" (
    echo [Onyx] First run detected - installing dependencies, this can take a few minutes...
    call npm install
    if errorlevel 1 (
        echo.
        echo [Onyx] npm install failed. Fix the error above and run this file again.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo   Onyx - Local AI Command Center
echo ============================================
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:4319
echo ============================================
echo.
echo Starting... (close this window or press Ctrl+C to stop)
echo.

call npm run dev

pause
