-- Inicialización de Bases de Datos para INBESTIGA.TESIS
-- Servidor Microsoft SQL Server 2022
-- Arquitectura Ralph Kimball: 1 Base Transaccional OLTP + 4 Data Marts Físicamente Independientes

USE master;
GO

-- 1. Base Transaccional OLTP
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_db')
BEGIN
    CREATE DATABASE inbestiga_db COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_db (OLTP) creada con éxito.';
END
GO

-- 2. Data Mart 1: Captación y Marketing (BUYERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_buyers')
BEGIN
    CREATE DATABASE inbestiga_dm_buyers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_buyers creada con éxito.';
END
GO

-- 3. Data Mart 2: Negociación y Conversión con IA (LEADS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_leads')
BEGIN
    CREATE DATABASE inbestiga_dm_leads COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_leads creada con éxito.';
END
GO

-- 4. Data Mart 3: Cobranza y Pasarela Culqi (PAYERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_payers')
BEGIN
    CREATE DATABASE inbestiga_dm_payers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_payers creada con éxito.';
END
GO

-- 5. Data Mart 4: Atención, Bitácora y Satisfacción (CUSTOMERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_customers')
BEGIN
    CREATE DATABASE inbestiga_dm_customers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_customers creada con éxito.';
END
GO
