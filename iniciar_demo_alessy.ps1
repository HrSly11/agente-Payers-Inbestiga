# PowerShell Script para iniciar la demo de Alessy Tania
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   INBESTIGA · PAYERS v2.0 - SISTEMA AGENTE IA DE COBRANZA" -ForegroundColor Green
Write-Host "   ENTORNO DE PRUEBAS PARA LA USUARIA: ALESSY TANIA" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Node check
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no está instalado en el PATH. Instala Node.js v20+ desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Node.js detectado: $(node -v)" -ForegroundColor Green

# 2. Config files
if (-not (Test-Path "apps\api\.env") -and (Test-Path "apps\api\.env.example")) {
    Copy-Item "apps\api\.env.example" "apps\api\.env"
    Write-Host "[OK] apps\api\.env creado." -ForegroundColor Green
}
if (-not (Test-Path "apps\web\.env.local")) {
    Set-Content "apps\web\.env.local" "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1"
    Write-Host "[OK] apps\web\.env.local creado." -ForegroundColor Green
}

# 3. Dependencias
if (-not (Test-Path "node_modules")) {
    Write-Host "[...] Instalando dependencias (npm install)..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  EXPEDIENTE DE PRUEBA: ALESSY TANIA" -ForegroundColor Green
Write-Host "  - Celular: 51994910334" -ForegroundColor White
Write-Host "  - Orden: ORD-2026-0001" -ForegroundColor White
Write-Host "  - Cuota Inicial: S/ 486.00 (Enlace enviado)" -ForegroundColor White
Write-Host "  - Bot Telegram: https://t.me/inbestiga_tesis_bot" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 4. Iniciar procesos
Start-Process cmd -ArgumentList "/k cd apps\api && npm run start:dev" -WindowStyle Normal
Start-Sleep -Seconds 4
Start-Process cmd -ArgumentList "/k cd apps\web && npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 5

Start-Process "http://localhost:3000/"
Write-Host "✓ Sistema levantado. Abre tu navegador en http://localhost:3000/" -ForegroundColor Green
