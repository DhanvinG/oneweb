param(
  [string]$InputDirectory = "tmp\pdfs\full-guide-render",
  [string]$OutputDirectory = "tmp\pdfs\full-guide-sheets"
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null

$files = Get-ChildItem -LiteralPath $InputDirectory -Filter "page-*.png" |
  Sort-Object {
    if ($_.BaseName -match "(\d+)$") { [int]$Matches[1] } else { 0 }
  }

$columns = 2
$rows = 3
$thumbWidth = 510
$thumbHeight = 660
$gap = 20
$labelHeight = 34
$sheetWidth = ($columns * $thumbWidth) + (($columns + 1) * $gap)
$sheetHeight = ($rows * ($thumbHeight + $labelHeight)) + (($rows + 1) * $gap)

for ($sheetIndex = 0; $sheetIndex -lt [Math]::Ceiling($files.Count / 6); $sheetIndex++) {
  $bitmap = New-Object System.Drawing.Bitmap($sheetWidth, $sheetHeight)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(38, 38, 38))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $font = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.Brushes]::White

  for ($slot = 0; $slot -lt 6; $slot++) {
    $fileIndex = ($sheetIndex * 6) + $slot
    if ($fileIndex -ge $files.Count) { break }

    $column = $slot % $columns
    $row = [Math]::Floor($slot / $columns)
    $x = $gap + ($column * ($thumbWidth + $gap))
    $y = $gap + ($row * ($thumbHeight + $labelHeight + $gap))

    $source = [System.Drawing.Image]::FromFile($files[$fileIndex].FullName)
    $graphics.DrawImage($source, $x, $y + $labelHeight, $thumbWidth, $thumbHeight)
    $graphics.DrawString(("PAGE {0:00}" -f ($fileIndex + 1)), $font, $brush, $x, $y)
    $source.Dispose()
  }

  $outputPath = Join-Path $OutputDirectory ("sheet-{0:00}.png" -f ($sheetIndex + 1))
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
