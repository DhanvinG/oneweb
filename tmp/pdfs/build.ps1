# Build pipeline for the 30-page OneWeb accessibility guide.
# Usage: powershell -File tmp\pdfs\build.ps1 [-SkipFinalize]
param([switch]$SkipFinalize)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repo

# Playwright is not installed in this repo; it resolves from the npx cache.
$env:NODE_PATH = "C:\Users\gdhan\AppData\Local\npm-cache\_npx\e41f203b7505f1fb\node_modules"

node tmp\pdfs\build_full_accessibility_guide.cjs
if ($LASTEXITCODE -ne 0) { Write-Error "Builder failed (exit $LASTEXITCODE)"; exit $LASTEXITCODE }

if (-not $SkipFinalize) {
  python tmp\pdfs\finalize_full_guide_pdf.py
  if ($LASTEXITCODE -ne 0) { Write-Error "Finalizer failed"; exit $LASTEXITCODE }
  python tmp\pdfs\validate_full_guide.py
  if ($LASTEXITCODE -ne 0) { Write-Error "Validator failed"; exit $LASTEXITCODE }
}
Write-Host "BUILD PIPELINE OK"
