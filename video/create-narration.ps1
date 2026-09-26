$ErrorActionPreference = 'Stop'

$outputPath = Join-Path $PSScriptRoot 'oneweb-narration.wav'
$voice = New-Object -ComObject SAPI.SpVoice
$stream = New-Object -ComObject SAPI.SpFileStream

$preferredVoice = $voice.GetVoices() | Where-Object {
    $_.GetDescription() -like '*Zira*'
} | Select-Object -First 1

if ($preferredVoice) {
    $voice.Voice = $preferredVoice
}

$voice.Rate = 0
$voice.Volume = 100
$stream.Open($outputPath, 3, $false)
$voice.AudioOutputStream = $stream

$script = @'
The web is where we learn, work, create, and connect. But too many people still meet digital barriers that shut them out.

OneWeb is a youth-led campaign building a future where everyone can access and use the web independently.

We bring together accessible technology, community knowledge, and public advocacy to turn inclusion into practical action.

Through digital accessibility tools, hands-on training, free resources, and policy advocacy, we help people and institutions remove barriers from the services and information we all rely on.

Our work has already reached more than two hundred fifty thousand people in over thirty countries, while raising more than thirty thousand dollars to expand the mission.

But a truly accessible web takes all of us. Learn. Share. Build access into everything you create.

Join OneWeb, and join the fight to end digital barriers.
'@

[void]$voice.Speak($script)
$stream.Close()

Write-Output ("Narration created: {0:N1} MB -> {1}" -f ((Get-Item $outputPath).Length / 1MB), $outputPath)
