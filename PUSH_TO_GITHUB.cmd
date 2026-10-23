@echo off
setlocal
cd /d "%~dp0"
set "GIT_EXE=git"
where git >nul 2>&1
if errorlevel 1 (
  set "GIT_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
)
if not exist "%GIT_EXE%" (
  where git >nul 2>&1
  if errorlevel 1 (
    echo Git executable was not found. Install Git for Windows or open this file from a Codex terminal.
    pause
    exit /b 1
  )
)
set "GCM_INTERACTIVE=always"
set "GCM_CREDENTIAL_STORE=wincredman"
echo Uploading OpsVision to GitHub...
"%GIT_EXE%" -c http.sslBackend=openssl push -u origin main
if errorlevel 1 (
  echo.
  echo Upload failed. Sign in to GitHub in the browser window, then run this file again.
) else (
  echo.
  echo Upload complete: https://github.com/yousefelsayed836-a1ly/ops-vision
)
pause
