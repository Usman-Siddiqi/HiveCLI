param(
  [switch]$Tauri
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$orchestratorUrl = "http://127.0.0.1:45231/health"

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
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

if (-not (Test-Command pnpm)) {
  throw "pnpm is not installed or not available on PATH."
}

$orchestratorCommand = "Set-Location '$repoRoot'; pnpm --filter @hive/orchestrator dev"

try {
  $health = Invoke-WebRequest -UseBasicParsing $orchestratorUrl -TimeoutSec 2
  if ($health.StatusCode -eq 200) {
    Write-Host "HiveCLI orchestrator already running on 127.0.0.1:45231" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Starting HiveCLI orchestrator..." -ForegroundColor Cyan
  Start-Process -FilePath powershell -WorkingDirectory $repoRoot -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    $orchestratorCommand
  ) | Out-Null

  if (-not (Wait-ForUrl -Url $orchestratorUrl)) {
    throw "The orchestrator did not become ready on http://127.0.0.1:45231 within 25 seconds."
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
