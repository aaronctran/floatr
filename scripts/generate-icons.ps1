# Run from any directory on Windows: powershell -File scripts/generate-icons.ps1
# Rasterize the editable SVG paths with supersampling for small toolbar icons.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
[xml]$source = Get-Content -LiteralPath (Join-Path $iconDirectory 'icon.svg') -Raw

function ConvertTo-GraphicsPath([string]$data) {
    $tokens = [regex]::Matches($data, '[MLCZ]|-?\d+(?:\.\d+)?')
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $index = 0
    [single]$x = 0
    [single]$y = 0
    while ($index -lt $tokens.Count) {
        $command = $tokens[$index++].Value
        switch ($command) {
            'M' {
                $x = [single]::Parse($tokens[$index++].Value, [cultureinfo]::InvariantCulture)
                $y = [single]::Parse($tokens[$index++].Value, [cultureinfo]::InvariantCulture)
                $path.StartFigure()
            }
            'L' {
                $nextX = [single]::Parse($tokens[$index++].Value, [cultureinfo]::InvariantCulture)
                $nextY = [single]::Parse($tokens[$index++].Value, [cultureinfo]::InvariantCulture)
                $path.AddLine($x, $y, $nextX, $nextY)
                $x = $nextX; $y = $nextY
            }
            'C' {
                $values = @()
                for ($i = 0; $i -lt 6; $i++) {
                    $values += [single]::Parse($tokens[$index++].Value, [cultureinfo]::InvariantCulture)
                }
                $path.AddBezier($x, $y, $values[0], $values[1], $values[2], $values[3], $values[4], $values[5])
                $x = $values[4]; $y = $values[5]
            }
            'Z' { $path.CloseFigure() }
            default { throw "Unsupported SVG path command: $command" }
        }
    }
    return ,$path
}

foreach ($size in @(16, 48, 128)) {
    $scale = 8
    $large = New-Object System.Drawing.Bitmap ($size * $scale), ($size * $scale)
    $graphics = [System.Drawing.Graphics]::FromImage($large)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform(($size * $scale / 128.0), ($size * $scale / 128.0))
    foreach ($shape in $source.svg.path) {
        $path = ConvertTo-GraphicsPath $shape.d
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($shape.fill))
        $graphics.FillPath($brush, $path)
        $brush.Dispose()
        $path.Dispose()
    }
    $graphics.Dispose()
    $output = New-Object System.Drawing.Bitmap $size, $size
    $resizer = [System.Drawing.Graphics]::FromImage($output)
    $resizer.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizer.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $resizer.DrawImage($large, 0, 0, $size, $size)
    $output.Save((Join-Path $iconDirectory "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $resizer.Dispose()
    $output.Dispose()
    $large.Dispose()
    Write-Output "Generated icon$size.png"
}
