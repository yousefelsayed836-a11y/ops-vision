$ErrorActionPreference = 'Stop'
$listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
    $serverProcessId = $listener.OwningProcess
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverProcessId"
    if ($serverProcess.Name -ne 'node.exe' -or $serverProcess.CommandLine -notmatch 'next') {
        Write-Host "Port 3000 belongs to another application (PID $serverProcessId). Nothing was stopped."
        exit 1
    }
    Stop-Process -Id $serverProcessId -Force
}
Start-Sleep -Seconds 2
exit 0
