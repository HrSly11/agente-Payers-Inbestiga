@echo off
chcp 65001 > nul
title INBESTIGA - Restauración y Población Completa de Bases de Datos

echo ======================================================================
echo    INBESTIGA . PAYERS v2.0 - RESTAURACIÓN COMPLETA DE BD
echo    SQL SERVER (INBESTIGA_TESIS, INBESTIGA_MART, inbestiga_db)
echo ======================================================================
echo.

where sqlcmd >nul 2>nul
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] sqlcmd no esta en el PATH. Intentando buscar en rutas estandar de Microsoft SQL Server...
    if exist "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" (
        set "SQLCMD=C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE"
    ) else if exist "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE" (
        set "SQLCMD=C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
    ) else (
        echo [ERROR] No se encontro la utilidad sqlcmd. Por favor instala sqlcmd o SQL Server Management Studio.
        pause
        exit /b 1
    )
) else (
    set "SQLCMD=sqlcmd"
)

echo [OK] Utilidad SQLCMD detectada.
echo.
echo Selecciona el metodo de restauracion preferido:
echo [1] Ejecutar Scripts SQL Definitivos (Recomendado - 100%% compatible entre cualquier version de SQL Server)
echo [2] Restaurar desde archivos de Backup .BAK
echo.
set /p METODO="Elige una opcion (1 o 2, default 1): "
if "%METODO%"=="" set METODO=1

if "%METODO%"=="1" (
    echo.
    echo ======================================================================
    echo  EJECUTANDO SCRIPTS SQL DEFINITIVOS DE CREACION Y POBLACION...
    echo ======================================================================
    echo.
    echo [1/7] Creando DDL INBESTIGA_TESIS...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\01_DDL_INBESTIGA_TESIS.sql"
    
    echo [2/7] Creando DDL INBESTIGA_MART (Data Mart Kimball)...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\02_DDL_INBESTIGA_MART.sql"
    
    echo [3/7] Poblando Catalogo, Servicios, Contactos y Ordenes (SEED)...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\03_SEED_INBESTIGA_TESIS.sql"
    
    echo [4/7] Aplicando Procedimientos ETL del Data Mart...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\04_ETL_POBLAR_DATAMART_DEFINITIVO.sql"
    
    echo [5/7] Creando Vistas de BI y Reportes R-PAYERS...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\05_VISTAS_REPORTE_RPAYERS.sql"
    
    echo [6/7] Aplicando Patch de Reglas de Negocio v2.0, Modalidad 4 y Bitacora...
    "%SQLCMD%" -S localhost -E -C -i "infrastructure\sql\definitivo\06_PATCH_REGLAS_NEGOCIO_Y_ACTUALIZACIONES.sql"
    
    echo [7/7] Configurando Caso de Prueba Inicial para Alessy Tania...
    "%SQLCMD%" -S localhost -E -C -i "scripts\preparar_alessy_inicio.sql"
    
    echo.
    echo ======================================================================
    echo  ¡POBLACION DE BASES DE DATOS COMPLETADA CON EXITO!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo  RESTAURANDO DESDE ARCHIVOS BACKUP (.BAK)...
    echo ======================================================================
    echo Copiando archivos de backup a carpeta de SQL Server...
    copy "backups\*.bak" "C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER2026\MSSQL\Backup\" >nul 2>nul
    copy "backups\*.bak" "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\" >nul 2>nul
    
    "%SQLCMD%" -S localhost -E -C -Q "RESTORE DATABASE INBESTIGA_TESIS FROM DISK = 'backups\INBESTIGA_TESIS.bak' WITH REPLACE; RESTORE DATABASE INBESTIGA_MART FROM DISK = 'backups\INBESTIGA_MART.bak' WITH REPLACE; RESTORE DATABASE inbestiga_db FROM DISK = 'backups\inbestiga_db.bak' WITH REPLACE;"
    echo.
    echo ======================================================================
    echo  ¡RESTAURACION DESDE .BAK COMPLETADA!
    echo ======================================================================
)

echo.
pause
