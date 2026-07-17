@echo off
chcp 65001 >nul
call "%~dp0config.bat"

cd /d "%BACKEND_DIR%"
npx pm2 start "%ECOSYSTEM%" 2>nul
npx pm2 save 2>nul
