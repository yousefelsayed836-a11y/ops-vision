@echo off
setlocal
cd /d "%~dp0"
set "GCM_INTERACTIVE=always"
set "GCM_CREDENTIAL_STORE=wincredman"
echo Uploading OpsVision to GitHub...
git -c http.sslBackend=openssl push -u origin main
if errorlevel 1 (
  echo.
  echo Upload failed. Sign in to GitHub in the browser window, then run this file again.
) else (
  echo.
  echo Upload complete: https://github.com/yousefelsayed836-a1ly/ops-vision
)
pause
