# Project Empire - Telegram Mini App Tunnel & Bot Configurator
param(
    [string]$BotToken = "8623512569:AAFTy5JE3vZjPBHOoCiEVxaCypk9E7hIOI4",
    [string]$NgrokPath = "C:\ngrok\ngrok.exe",
    [int]$Port = 5173
)

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "🚀 Project Empire — Telegram Tunnel & Bot Hazırlayıcı" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Ngrok tünelini kontrol et veya başlat
$tunnelUrl = $null
try {
    $tunnelsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
    $publicTunnel = $tunnelsResponse.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
    if ($publicTunnel) {
        $tunnelUrl = $publicTunnel.public_url
        Write-Host "✅ Aktif ngrok tüneli bulundu: $tunnelUrl" -ForegroundColor Green
    }
} catch {
    # ngrok çalışmıyor
}

if (-not $tunnelUrl) {
    if (Test-Path $NgrokPath) {
        Write-Host "📡 Ngrok başlatılıyor ($NgrokPath http $Port)..." -ForegroundColor Cyan
        Start-Process -FilePath $NgrokPath -ArgumentList "http $Port" -WindowStyle Minimized
        
        # 10 saniye boyunca tünel URL'sini bekle
        for ($i = 0; $i -lt 10; $i++) {
            Start-Sleep -Seconds 1
            try {
                $tunnelsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
                $publicTunnel = $tunnelsResponse.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
                if ($publicTunnel) {
                    $tunnelUrl = $publicTunnel.public_url
                    break
                }
            } catch { }
        }
    } else {
        Write-Host "⚠️ Uyarı: $NgrokPath bulunamadı. Lütfen ngrok'u elle başlatıp bu scripti tekrar çalıştırın." -ForegroundColor Red
        return
    }
}

if (-not $tunnelUrl) {
    Write-Host "❌ Ngrok tünel URL'si alınamadı! Lütfen ngrok'un çalıştığından emin olun." -ForegroundColor Red
    return
}

Write-Host "🌐 Public URL: $tunnelUrl" -ForegroundColor Green

# 2. .dev.vars dosyasını güncelle
$devVarsPath = Join-Path $PSScriptRoot "..\apps\api\.dev.vars"
if (Test-Path $devVarsPath) {
    $content = Get-Content $devVarsPath -Raw
    $content = $content -replace "APP_ORIGIN=.*", "APP_ORIGIN=$tunnelUrl"
    Set-Content -Path $devVarsPath -Value $content -NoNewline
    Write-Host "📝 apps/api/.dev.vars güncellendi (APP_ORIGIN = $tunnelUrl)" -ForegroundColor Green
}

# 3. Telegram Bot Menü Butonunu (setChatMenuButton) Güncelle
Write-Host "🤖 Telegram Bot menü butonu güncelleniyor (@PemtokenBot)..." -ForegroundColor Cyan
$menuButtonBody = @{
    menu_button = @{
        type = "web_app"
        text = "Oyna 🎮"
        web_app = @{
            url = $tunnelUrl
        }
    }
} | ConvertTo-Json -Depth 5

try {
    $setBtnRes = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BotToken/setChatMenuButton" `
        -Method Post `
        -ContentType "application/json; charset=utf-8" `
        -Body $menuButtonBody
    
    if ($setBtnRes.ok) {
        Write-Host "✅ Telegram Bot Menü Butonu Başarıyla Güncellendi!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Bot yanıtı: $($setBtnRes.description)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Bot API isteği başarısız: $_" -ForegroundColor Red
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "🎉 HAZIR! Telegram'da Test Edebilirsiniz:" -ForegroundColor Green
Write-Host "👉 Bot Linki: https://t.me/PemtokenBot" -ForegroundColor Yellow
Write-Host "👉 Mini App Linki: $tunnelUrl" -ForegroundColor Yellow
Write-Host "=======================================================`n" -ForegroundColor Cyan
