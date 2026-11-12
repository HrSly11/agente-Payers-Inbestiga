-- =============================================================================
-- INBESTIGA.TESIS - Base de Datos Transaccional (OLTP): inbestiga_db
-- Inicialización de Base de Datos y Opciones de Servidor
-- =============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_db')
BEGIN
    CREATE DATABASE inbestiga_db COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_db (OLTP) creada con éxito.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_db ya existe.';
END
GO

USE inbestiga_db;
GO
