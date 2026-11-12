-- =============================================================================
-- INBESTIGA.TESIS - Creación de las 4 Bases de Datos Físicas de Data Marts
-- Metodología Ralph Kimball: Data Marts Independientes orientados a Procesos
-- Bases de Datos: inbestiga_dm_buyers, inbestiga_dm_leads, 
--                 inbestiga_dm_payers, inbestiga_dm_customers
-- =============================================================================

USE master;
GO

-- 1. Base de Datos para Data Mart de Captación y Marketing (Fase 1: BUYERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_buyers')
BEGIN
    CREATE DATABASE inbestiga_dm_buyers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_buyers creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_dm_buyers ya existe.';
END
GO

-- 2. Base de Datos para Data Mart de Conversión y Negociación IA (Fase 2: LEADS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_leads')
BEGIN
    CREATE DATABASE inbestiga_dm_leads COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_leads creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_dm_leads ya existe.';
END
GO

-- 3. Base de Datos para Data Mart de Cobranza y Pasarela Culqi (Fase 3: PAYERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_payers')
BEGIN
    CREATE DATABASE inbestiga_dm_payers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_payers creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_dm_payers ya existe.';
END
GO

-- 4. Base de Datos para Data Mart de Atención, Bitácora y Satisfacción (Fase 4: CUSTOMERS)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_dm_customers')
BEGIN
    CREATE DATABASE inbestiga_dm_customers COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_dm_customers creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_dm_customers ya existe.';
END
GO
