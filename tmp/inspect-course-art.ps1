Add-Type -AssemblyName System.Drawing
for ($batch = 0; $batch -lt 6; $batch++) {
  $canvas = New-Object System.Drawing.Bitmap 1200,1500
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font 'Arial',14
  for ($row = 0; $row -lt 5; $row++) {
    $folder = ($batch * 5 + $row).ToString('00')
    for ($slide = 1; $slide -le 4; $slide++) {
      $source = [System.Drawing.Image]::FromFile((Join-Path $PWD "public/learning-hub/lessons/$folder/$slide.png"))
      $graphics.DrawImage($source, ($slide - 1) * 300, $row * 300 + 24, 276, 276)
      $graphics.DrawString("$folder / $slide", $font, [System.Drawing.Brushes]::Black, ($slide - 1) * 300, $row * 300)
      $source.Dispose()
    }
  }
  $canvas.Save((Join-Path $PWD "tmp/course-reference-$batch.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $graphics.Dispose()
  $canvas.Dispose()
  $font.Dispose()
}
