# Render every page of the guide PDF to PNG for visual QA, then build contact sheets.
# Usage: powershell -File tmp\pdfs\render_pages.ps1 [-OutDir <dir>] [-Dpi 120]
param(
  [string]$OutDir = "tmp\pdfs\full-guide-render-v2",
  [int]$Dpi = 120
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repo

$pdf = "output\pdf\OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"
if (-not (Test-Path $pdf)) { Write-Error "PDF not found: $pdf"; exit 1 }

$pdftoppm = "C:\Users\gdhan\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdftoppm.exe"

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

& $pdftoppm -r $Dpi -png $pdf (Join-Path $OutDir "page")
if ($LASTEXITCODE -ne 0) { Write-Error "pdftoppm failed"; exit $LASTEXITCODE }

# pdftoppm names files page-01.png .. page-30.png (zero-padded for 2-digit counts)
$count = (Get-ChildItem $OutDir -Filter "page-*.png").Count
Write-Host "Rendered $count pages to $OutDir"

$sheetDir = "$OutDir-sheets"
if (Test-Path $sheetDir) { Remove-Item -Recurse -Force $sheetDir }
powershell -NoProfile -ExecutionPolicy Bypass -File tmp\pdfs\make_contact_sheets.ps1 -InputDirectory $OutDir -OutputDirectory $sheetDir
Write-Host "Contact sheets in $sheetDir"
