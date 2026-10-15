@echo off
chcp 65001 > nul
echo ============================================
echo  大阪市GISアプリ ローカルサーバー起動
echo ============================================
echo.

:: IPアドレスを取得
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%A
    goto :found
)
:found
set IP=%IP: =%

echo [起動中] http://localhost:8000
echo.
echo ★ 同じWiFi内の他のPCからアクセスするには:
echo    http://%IP%:8000
echo.
echo ============================================
echo Ctrl+C でサーバーを停止できます
echo ============================================
echo.

cd /d "%~dp0"
npx --yes serve -l 8000 -s .
