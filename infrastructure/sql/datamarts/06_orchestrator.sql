-- =============================================================================
-- INBESTIGA.TESIS - Procedimiento Orquestador Maestro de ETL
-- Ejecuta secuencialmente los ETLs departamentales de los 4 Data Marts
-- Bases de Datos: inbestiga_dm_buyers, inbestiga_dm_leads,
--                 inbestiga_dm_payers, inbestiga_dm_customers
-- =============================================================================

USE inbestiga_db;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_populate_datamarts
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '=============================================================================';
    PRINT '>> INICIANDO ORQUESTADOR DE ETL: POBLANDO LOS 4 DATA MARTS INDEPENDIENTES';
    PRINT '=============================================================================';

    -- 1. Fase 1: Data Mart Captación y Marketing (inbestiga_dm_buyers)
    PRINT '1. Ejecutando ETL para inbestiga_dm_buyers...';
    EXEC inbestiga_dm_buyers.dbo.sp_etl_dm_buyers;

    -- 2. Fase 2: Data Mart Negociación y Conversión con IA (inbestiga_dm_leads)
    PRINT '2. Ejecutando ETL para inbestiga_dm_leads...';
    EXEC inbestiga_dm_leads.dbo.sp_etl_dm_leads;

    -- 3. Fase 3: Data Mart Cobranza y Pasarela Culqi (inbestiga_dm_payers)
    PRINT '3. Ejecutando ETL para inbestiga_dm_payers...';
    EXEC inbestiga_dm_payers.dbo.sp_etl_dm_payers;

    -- 4. Fase 4: Data Mart Atención, Bitácora y Satisfacción (inbestiga_dm_customers)
    PRINT '4. Ejecutando ETL para inbestiga_dm_customers...';
    EXEC inbestiga_dm_customers.dbo.sp_etl_dm_customers;

    PRINT '=============================================================================';
    PRINT '✓ SINCRONIZACIÓN EXITOSA: Los 4 Data Marts han sido sincronizados desde inbestiga_db';
    PRINT '=============================================================================';
END;
GO
