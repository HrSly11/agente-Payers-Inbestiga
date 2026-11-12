-- =============================================================================
-- INBESTIGA.TESIS - Script Maestro de Despliegue de la BD Transaccional (OLTP)
-- Compila las tablas transaccionales de las 4 fases del embudo IMPULSE en orden
-- =============================================================================

USE inbestiga_db;
GO

PRINT '=============================================================================';
PRINT 'INICIANDO DESPLIEGUE MODULAR TRANSACCIONAL (OLTP) - inbestiga_db';
PRINT '=============================================================================';

-- 1. Catálogos Transversales y Seguridad
:r ./01_catalogos_transversales.sql

-- 2. Fase 1: BUYERS (Captación y Marketing)
:r ./02_fase1_buyers.sql

-- 3. Fase 2: LEADS (Conversión y Negociación IA)
:r ./03_fase2_leads.sql

-- 4. Fase 3: PAYERS (Cobranza y Pasarela Culqi)
:r ./04_fase3_payers.sql

-- 5. Fase 4: CUSTOMERS (Atención y Bitácora del Servicio)
:r ./05_fase4_customers.sql

PRINT '=============================================================================';
PRINT '✓ DESPLIEGUE MODULAR DE TODAS LAS TABLAS TRANSACCIONALES COMPLETADO CON ÉXITO.';
PRINT '=============================================================================';
GO
