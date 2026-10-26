param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$url = 'http://localhost:8601'
$running = $false
try {
    $health = Invoke-RestMethod "http://127.0.0.1:8601/healthz" -TimeoutSec 3
    if ($health.app -ne 'scratch-local-web') { throw 'Port 8601 is used by another application.' }
    $running = $true
} catch {
    if ($_.Exception.Message -like '*another application*') { throw }
}
if (-not $running) {
    $node = Join-Path $projectRoot 'tools\node-v24.22.1\node.exe'
    $server = Join-Path $PSScriptRoot 'serve-scratch-web.cjs'
    $logs = Join-Path $projectRoot '.cache\web'
    New-Item -ItemType Directory -Force -Path $logs | Out-Null
    $process = Start-Process -FilePath $node -ArgumentList @('"' + $server + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        $process.Refresh()
        if ($process.HasExited) { throw "Scratch server failed. See $logs\server-error.log" }
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:8601/healthz" -TimeoutSec 3
            if ($health.app -eq 'scratch-local-web') { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) { throw "Scratch server did not become ready. See $logs" }
    Set-Content -LiteralPath (Join-Path $logs 'server.pid') -Value $process.Id
}
Write-Output "Scratch is running at $url"
if ($OpenBrowser) { Start-Process $url }
