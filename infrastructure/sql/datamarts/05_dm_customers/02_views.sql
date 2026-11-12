-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 4: CUSTOMERS (Atención, Bitácora y Satisfacción)
-- Vistas Analíticas de Indicadores (KPIs) - inbestiga_dm_customers
-- Metodología Ralph Kimball: Esquema Estrella Atómico Separado
-- =============================================================================

USE inbestiga_dm_customers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- KPI 4.1: Tiempo de Asignación de Asesor tras Pago Confirmado (Meta: <= 24 h)
CREATE OR ALTER VIEW dbo.vw_kpi_customers_tiempo_asignacion AS
SELECT
    COUNT(*) AS total_asignaciones,
    AVG(horas_asignacion_asesor) AS horas_promedio_asignacion,
    MIN(horas_asignacion_asesor) AS horas_minimas_asignacion,
    MAX(horas_asignacion_asesor) AS horas_maximas_asignacion,
    CASE 
        WHEN AVG(horas_asignacion_asesor) <= 24 THEN 'VERDE'
        WHEN AVG(horas_asignacion_asesor) <= 48 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_ATENCION
WHERE horas_asignacion_asesor IS NOT NULL AND horas_asignacion_asesor >= 0;
GO

-- KPI 4.2: Tasa de Primera Sesión Agendada dentro de 48h (Meta: >= 85%)
CREATE OR ALTER VIEW dbo.vw_kpi_customers_primera_sesion_48h AS
SELECT
    COUNT(*) AS total_customers_atendidos,
    SUM(CASE WHEN primera_sesion_48h = 1 THEN 1 ELSE 0 END) AS sesiones_en_menos_48h,
    CAST(SUM(CASE WHEN primera_sesion_48h = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_primera_sesion_48h_pct,
    CASE 
        WHEN (SUM(CASE WHEN primera_sesion_48h = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 85.0 THEN 'VERDE'
        WHEN (SUM(CASE WHEN primera_sesion_48h = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 65.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_ATENCION;
GO

-- KPI 4.3: Tasa de Cumplimiento del Cronograma (Meta: >= 75%)
CREATE OR ALTER VIEW dbo.vw_kpi_customers_cumplimiento_cronograma AS
SELECT
    SUM(sesiones_programadas) AS total_sesiones_programadas,
    SUM(sesiones_realizadas) AS total_sesiones_realizadas,
    CAST(SUM(sesiones_realizadas) * 1.0 / NULLIF(SUM(sesiones_programadas), 0) * 100 AS DECIMAL(5,2)) AS tasa_cumplimiento_cronograma_pct,
    CAST(AVG(porcentaje_avance_tesis) AS DECIMAL(5,2)) AS promedio_avance_tesis_pct,
    CASE 
        WHEN (SUM(sesiones_realizadas) * 1.0 / NULLIF(SUM(sesiones_programadas), 0) * 100) >= 75.0 THEN 'VERDE'
        WHEN (SUM(sesiones_realizadas) * 1.0 / NULLIF(SUM(sesiones_programadas), 0) * 100) >= 55.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_ATENCION;
GO

-- KPI 4.4: Tasa de Detección Temprana de Casos de Riesgo (Meta: <= 20%)
CREATE OR ALTER VIEW dbo.vw_kpi_customers_deteccion_riesgo AS
SELECT
    COUNT(*) AS total_tesistas_monitoreados,
    SUM(CASE WHEN alerta_riesgo_abandono = 1 THEN 1 ELSE 0 END) AS casos_con_alerta_riesgo,
    CAST(SUM(CASE WHEN alerta_riesgo_abandono = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_casos_en_riesgo_pct,
    CASE 
        WHEN (SUM(CASE WHEN alerta_riesgo_abandono = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) <= 20.0 THEN 'VERDE'
        WHEN (SUM(CASE WHEN alerta_riesgo_abandono = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) <= 35.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_ATENCION;
GO

-- KPI 4.5: Satisfacción Promedio del Tesista (Meta: >= 4.2 / 5.0)
CREATE OR ALTER VIEW dbo.vw_kpi_customers_satisfaccion AS
SELECT
    COUNT(CASE WHEN puntaje_satisfaccion_encuesta IS NOT NULL THEN 1 END) AS total_encuestas_respondidas,
    CAST(AVG(puntaje_satisfaccion_encuesta) AS DECIMAL(3,2)) AS satisfaccion_promedio_estrellas,
    CASE 
        WHEN AVG(puntaje_satisfaccion_encuesta) >= 4.20 THEN 'VERDE'
        WHEN AVG(puntaje_satisfaccion_encuesta) >= 3.50 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_ATENCION
WHERE puntaje_satisfaccion_encuesta IS NOT NULL;
GO
