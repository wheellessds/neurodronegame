@echo off
chcp 65001 >nul
echo Starting Neuro's Drone Delivery Service 2...
echo.
echo 正在尋找您的本機 IP 地址 (用於手機連線)...
for /f "tokens=4 delims=: " %%i in ('netsh interface ip show address ^| findstr "IP" ^| findstr /v "127.0.0.1"') do (
    echo [提示] 您的網路 IP 可能是: %%i
)
echo.
echo 正在啟動開發伺服器...
echo [注意] 如果手機連不上，請確保：
echo 1. 手機與電腦連接同一個 Wi-Fi
echo 2. 電腦的「Windows 防火牆」已允許連線
echo 3. 請查看下方啟動成功的連結 (例如 3000 或 3002)
echo.
echo [重要] 請在手機輸入綠色 Network 顯示的完整網址！
echo.
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo 啟動失敗。嘗試使用備用命令...
    npm.cmd run dev
)
pause
