param(
  [switch]$Tauri
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $repoRoot

if ($Tauri) {
  node .\scripts\start-hivecli.mjs --tauri
  exit $LASTEXITCODE
}

node .\scripts\start-hivecli.mjs
exit $LASTEXITCODE
