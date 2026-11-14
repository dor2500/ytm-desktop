# ========================================================
#  Nebula Music - One-Line Windows Installer
#  Usage: irm https://raw.githubusercontent.com/dor2500/ytm-desktop/master/install.ps1 | iex
# ========================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  _   _      _             _         __  __           _      " -ForegroundColor Cyan
Write-Host " | \ | | ___| |__  _   _  | | __ _  |  \/  |_   _ ___(_) ___ " -ForegroundColor Cyan
Write-Host " |  \| |/ _ \ '_ \| | | | | |/ _` | | |\/| | | | / __| |/ __|" -ForegroundColor Cyan
Write-Host " | |\  |  __/ |_) | |_| | | | (_| | | |  | | |_| \__ \ | (__ " -ForegroundColor Cyan
Write-Host " |_| \_|\___|_.__/ \__,_| |_|\__,_| |_|  |_|\__,_|___/_|\___|" -ForegroundColor Cyan
Write-Host " Universal Desktop Music Player (YouTube Music, Spotify, SoundCloud)" -ForegroundColor DarkGray
Write-Host ""

$repo = "dor2500/ytm-desktop"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

Write-Host "--> Checking latest release from GitHub..." -ForegroundColor Yellow

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers @{ "User-Agent" = "PowerShell" }
    $asset = $release.assets | Where-Object { $_.name -like "*Setup*.exe" -or $_.name -like "*.exe" } | Select-Object -First 1

    if (-not $asset) {
        throw "Could not find an .exe release asset in the latest release."
    }

    $downloadUrl = $asset.browser_download_url
    $fileName = $asset.name
    $tempPath = Join-Path $env:TEMP $fileName

    Write-Host "--> Found release: $($release.tag_name) ($fileName)" -ForegroundColor Green
    Write-Host "--> Downloading Nebula Music ($([math]::Round($asset.size / 1MB, 2)) MB)..." -ForegroundColor Yellow

    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempPath -UseBasicParsing

    Write-Host "--> Launching installer..." -ForegroundColor Green
    Start-Process -FilePath $tempPath

    Write-Host ""
    Write-Host "[✓] Nebula Music installation started successfully!" -ForegroundColor Green
    Write-Host "    Enjoy ad-free music across YouTube Music, Spotify & SoundCloud." -ForegroundColor Cyan
    Write-Host ""
}
catch {
    Write-Host "[!] Installation failed: $_" -ForegroundColor Red
    Write-Host "    You can manually download the latest release from: https://github.com/$repo/releases" -ForegroundColor Yellow
}
