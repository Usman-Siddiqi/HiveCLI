param(
  [switch]$Tauri
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$orchestratorUrl = "http://127.0.0.1:45231/health"
$logDir = Join-Path $repoRoot ".hivecli\logs"
$orchestratorOutLog = Join-Path $logDir "orchestrator.out.log"
$orchestratorErrLog = Join-Path $logDir "orchestrator.err.log"

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeMajorVersion {
  $raw = node -p "process.versions.node" 2>$null
  if (-not $raw) {
    throw "Node.js is not installed or not available on PATH."
  }

  return [int](($raw -split "\.")[0])
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 25
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }

  return $false
}

function Get-LogTail {
  param([string]$Path)
  if (Test-Path $Path) {
    return (Get-Content $Path -Tail 40) -join [Environment]::NewLine
  }

  return ""
}

function Throw-StartupFailure {
  $stderr = Get-LogTail $orchestratorErrLog
  $stdout = Get-LogTail $orchestratorOutLog
  $combined = @($stderr, $stdout) -join [Environment]::NewLine

  if ($combined -match "better-sqlite3" -or $combined -match "Could not locate the bindings file") {
    throw @"
HiveCLI could not start because the native SQLite dependency is not built for this Node installation.

Detected issue:
$combined

Fix:
1. Switch to Node 22 LTS.
2. Run `pnpm install`
3. Run `pnpm approve-builds`
4. Run `pnpm rebuild better-sqlite3 node-pty esbuild`

After that, run `pnpm start` again.
"@
  }

  if ($combined -match "node-pty") {
    throw @"
HiveCLI could not start because the native PTY dependency is not built for this Node installation.

Detected issue:
$combined

Fix:
1. Switch to Node 22 LTS.
2. Run `pnpm install`
3. Run `pnpm approve-builds`
4. Run `pnpm rebuild better-sqlite3 node-pty esbuild`

After that, run `pnpm start` again.
"@
  }

  if ($combined.Trim()) {
    throw @"
HiveCLI could not start the orchestrator.

Recent orchestrator output:
$combined
"@
  }

  throw "The orchestrator did not become ready on http://127.0.0.1:45231 within 25 seconds."
}

if (-not (Test-Command pnpm)) {
  throw "pnpm is not installed or not available on PATH."
}

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -ne 22) {
  throw "HiveCLI currently requires Node 22 LTS. Current Node major version: $nodeMajor. Switch to Node 22, then run `pnpm install` and `pnpm start` again."
}

New-Item -ItemType Directory -Force $logDir | Out-Null

try {
  $health = Invoke-WebRequest -UseBasicParsing $orchestratorUrl -TimeoutSec 2
  if ($health.StatusCode -eq 200) {
    Write-Host "HiveCLI orchestrator already running on 127.0.0.1:45231" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Starting HiveCLI orchestrator..." -ForegroundColor Cyan
  if (Test-Path $orchestratorOutLog) { Remove-Item $orchestratorOutLog -Force }
  if (Test-Path $orchestratorErrLog) { Remove-Item $orchestratorErrLog -Force }

  Start-Process -FilePath powershell -WorkingDirectory $repoRoot -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "Set-Location '$repoRoot'; pnpm --filter @hive/orchestrator dev"
  ) -RedirectStandardOutput $orchestratorOutLog -RedirectStandardError $orchestratorErrLog | Out-Null

  if (-not (Wait-ForUrl -Url $orchestratorUrl)) {
    Throw-StartupFailure
  }
}

if ($Tauri) {
  if (-not (Test-Command cargo)) {
    throw "Rust/cargo is not installed. Run without -Tauri to launch the browser UI, or install the Tauri prerequisites first."
  }

  Write-Host "Starting HiveCLI desktop shell..." -ForegroundColor Cyan
  Set-Location $repoRoot
  pnpm --filter @hive/desktop dev:tauri
  exit $LASTEXITCODE
}

Write-Host "Starting HiveCLI frontend at http://localhost:1420 ..." -ForegroundColor Cyan
Set-Location $repoRoot
pnpm --filter @hive/desktop dev
