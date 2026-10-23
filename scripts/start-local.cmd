@echo off
cd /d "C:\Users\DELL\Documents\Codex\2026-10-14\new-chat\outputs\opsvision"
if not exist ".data\tmp" mkdir ".data\tmp"
set "TEMP=C:\Users\DELL\Documents\Codex\2026-10-14\new-chat\outputs\opsvision\.data\tmp"
set "TMP=C:\Users\DELL\Documents\Codex\2026-10-14\new-chat\outputs\opsvision\.data\tmp"
set "OPSVISION_DIST_DIR=.next-dev-persistent"
node scripts/run.mjs next dev --webpack --hostname 0.0.0.0 --port 3001 >> ".data\persistent-server.log" 2>&1
