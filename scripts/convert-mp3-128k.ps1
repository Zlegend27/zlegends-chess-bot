<#
  Batch re-encodes every mp3 in a folder down to 128kbps, so Juice Box
  playlists buffer fast on mobile instead of streaming ~300kbps+ files.
  Writes to a sibling "128kbps" subfolder rather than overwriting
  originals -- re-upload that subfolder's contents to Supabase Storage
  in place of what's there now (same filenames, so URLs don't change).

  Requires ffmpeg on PATH. Install with one of:
    winget install Gyan.FFmpeg
    choco install ffmpeg
  or download a build from https://ffmpeg.org/download.html and add its
  bin folder to PATH.

  Usage:
    .\scripts\convert-mp3-128k.ps1 -InputFolder "C:\path\to\juice"
    .\scripts\convert-mp3-128k.ps1 -InputFolder "C:\path\to\omori"
#>
param(
  [Parameter(Mandatory = $true)][string]$InputFolder,
  [string]$OutputFolder = (Join-Path $InputFolder "128kbps")
)

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found on PATH -- see the install notes at the top of this script."
  exit 1
}
if (-not (Test-Path $InputFolder)) {
  Write-Error "Input folder not found: $InputFolder"
  exit 1
}
New-Item -ItemType Directory -Force -Path $OutputFolder | Out-Null

$files = Get-ChildItem -Path $InputFolder -Filter *.mp3
if ($files.Count -eq 0) {
  Write-Warning "No .mp3 files found in $InputFolder"
  exit 0
}

foreach ($f in $files) {
  $out = Join-Path $OutputFolder $f.Name
  Write-Host "Converting $($f.Name)..."
  ffmpeg -y -v error -i $f.FullName -b:a 128k -ar 44100 -ac 2 $out
}

Write-Host ""
Write-Host "Done. $($files.Count) file(s) converted into:"
Write-Host "  $OutputFolder"
Write-Host "Upload those files to Supabase Storage, overwriting the originals at the same path."
