@echo off
chcp 65001 > nul
title INBESTIGA-PAYERS :: Demo de Pruebas - Alessy Tania

echo ======================================================================
echo    INBESTIGA . PAYERS v2.0 - SISTEMA AGENTE IA DE COBRANZA
echo    ENTORNO DE PRUEBAS PARA LA USUARIA: ALESSY TANIA
echo ======================================================================
echo.
echo [1/4] Verificando dependencias de Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js v20 o superior desde https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js detectado:
node -v
npm -v
echo.

echo [2/4] Verificando archivos de configuracion (.env)...
if not exist "apps\api\.env" (
    if exist "apps\api\.env.example" (
        echo Creando apps\api\.env desde .env.example...
        copy "apps\api\.env.example" "apps\api\.env" >nul
    )
)

if not exist "apps\web\.env.local" (
    if exist "apps\web\.env.example" (
        echo Creando apps\web\.env.local...
        copy "apps\web\.env.example" "apps\web\.env.local" >nul
    ) else (
        echo NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 > apps\web\.env.local
    )
)

echo [3/4] Instalando paquetes si es necesario...
if not exist "node_modules" (
    echo Instalando dependencias del monorepo (npm install)...
    call npm install
)

echo.
echo ======================================================================
echo    DATOS DEL EXPEDIENTE DE PRUEBA:
echo    - Estudiante: Alessy Tania
echo    - Universidad: Universidad Nacional de Trujillo (UNT)
echo    - Carrera: Ingenieria de Sistemas
echo    - Expediente / Orden: ORD-2026-0001
echo    - Telefono Registrado: 51994910334
echo    - Telegram Bot: @inbestiga_tesis_bot
echo    - Cuota Inicial exigible: Cuota #1 (S/ 486.00) con enlace Mercado Pago
echo ======================================================================
echo.

echo [4/4] Levantando Servidores Backend (NestJS :4000) y Frontend (Next.js :3000)...
echo.
start "INBESTIGA-API (:4000)" cmd /k "cd apps\api && npm run start:dev"
timeout /t 5 >nul
start "INBESTIGA-WEB (:3000)" cmd /k "cd apps\web && npm run dev"

timeout /t 6 >nul
echo.
echo Abriendo navegador en la Landing del Estudiante...
start http://localhost:3000/

echo.
echo ======================================================================
echo  SISTEMA EN EJECUCION EXITOSA:
echo  - Portal Estudiante: http://localhost:3000/
echo  - Panel Admin Cobranza: http://localhost:3000/admin/customers
echo  - Checkout Directo Cuota 1: http://localhost:3000/checkout/ORD-2026-0001
echo  - Telegram Bot: https://t.me/inbestiga_tesis_bot
echo ======================================================================
echo Presiona cualquier tecla para cerrar esta ventana de control (los servidores continuaran corriendo).
pause >nul
