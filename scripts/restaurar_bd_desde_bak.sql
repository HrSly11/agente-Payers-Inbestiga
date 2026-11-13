-- ======================================================================
-- INBESTIGA - Script Universal de Restauración desde Backups (.bak)
-- ======================================================================
USE master;
GO

-- 1. Cerrar conexiones activas para permitir reemplazo limpio
IF DB_ID('INBESTIGA_TESIS') IS NOT NULL
BEGIN
    ALTER DATABASE INBESTIGA_TESIS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE INBESTIGA_TESIS;
END
GO

IF DB_ID('INBESTIGA_MART') IS NOT NULL
BEGIN
    ALTER DATABASE INBESTIGA_MART SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE INBESTIGA_MART;
END
GO

IF DB_ID('inbestiga_db') IS NOT NULL
BEGIN
    ALTER DATABASE inbestiga_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE inbestiga_db;
END
GO

-- Variables para detectar ruta de datos predeterminada del servidor
DECLARE @defaultDataPath NVARCHAR(512);
DECLARE @defaultLogPath NVARCHAR(512);

EXEC master.dbo.xp_instance_regread 
    N'HKEY_LOCAL_MACHINE', 
    N'Software\Microsoft\MSSQLServer\MSSQLServer', 
    N'DefaultData', 
    @defaultDataPath OUTPUT;

EXEC master.dbo.xp_instance_regread 
    N'HKEY_LOCAL_MACHINE', 
    N'Software\Microsoft\MSSQLServer\MSSQLServer', 
    N'DefaultLog', 
    @defaultLogPath OUTPUT;

IF @defaultDataPath IS NULL
    SET @defaultDataPath = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(512));
IF @defaultLogPath IS NULL
    SET @defaultLogPath = CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS NVARCHAR(512));

PRINT 'Ruta de datos destino: ' + @defaultDataPath;
PRINT 'Ruta de logs destino: ' + @defaultLogPath;
GO

PRINT '✓ Bases de datos preparadas para restauración.';
GO
