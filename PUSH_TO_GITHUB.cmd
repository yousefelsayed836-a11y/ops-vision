@echo off
setlocal
set "PROJECT_DIR=C:\Users\DELL\Documents\Codex\2026-10-14\new-chat\outputs\opsvision"
cd /d "%PROJECT_DIR%"
if not exist ".git\config" (
  echo Cannot find the Git repository in: %PROJECT_DIR%
  pause
  exit /b 1
)
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
if "%~1"=="--check" (
  "%GIT_EXE%" -c safe.directory="%PROJECT_DIR%" rev-parse --show-toplevel
  exit /b %errorlevel%
)
set "GCM_INTERACTIVE=always"
set "GCM_CREDENTIAL_STORE=wincredman"
echo Uploading OpsVision to GitHub...
"%GIT_EXE%" -c safe.directory="%PROJECT_DIR%" -c http.sslBackend=openssl push -u origin main
if errorlevel 1 (
  echo.
  echo Upload failed. Read the error above, then run this file again after fixing it.
) else (
  echo.
  echo Upload complete: https://github.com/yousefelsayed836-a11y/ops-vision
)
pause
