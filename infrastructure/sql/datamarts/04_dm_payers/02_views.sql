-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 3: PAYERS (Cobranza y Pasarela Culqi)
-- Vistas Analíticas de Indicadores (KPIs) - inbestiga_dm_payers
-- Metodología Ralph Kimball: Esquema Estrella Atómico Separado
-- =============================================================================

USE inbestiga_dm_payers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- KPI 3.1: Tasa de Conversión de Propuesta a Pago (Meta: >= 60%)
CREATE OR ALTER VIEW dbo.vw_kpi_payers_conversion AS
SELECT
    COUNT(DISTINCT fn.estudiante_key) AS total_propuestas_aceptadas,
    COUNT(DISTINCT fc.estudiante_key) AS total_estudiantes_con_pago,
    CAST(COUNT(DISTINCT fc.estudiante_key) * 1.0 / NULLIF(COUNT(DISTINCT fn.estudiante_key), 0) * 100 AS DECIMAL(5,2)) AS tasa_conversion_propuesta_pago_pct,
    CASE 
        WHEN (COUNT(DISTINCT fc.estudiante_key) * 1.0 / NULLIF(COUNT(DISTINCT fn.estudiante_key), 0) * 100) >= 60.0 THEN 'VERDE'
        WHEN (COUNT(DISTINCT fc.estudiante_key) * 1.0 / NULLIF(COUNT(DISTINCT fn.estudiante_key), 0) * 100) >= 40.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM inbestiga_dm_leads.dbo.FACT_NEGOCIACION fn
LEFT JOIN dbo.FACT_COBRANZA fc ON fc.estudiante_key = fn.estudiante_key AND fc.pago_confirmado = 1
WHERE fn.propuesta_aceptada = 1;
GO

-- KPI 3.2: Tiempo Promedio de Confirmación de Pago Culqi (Meta: <= 10 min)
CREATE OR ALTER VIEW dbo.vw_kpi_payers_tiempo_confirmacion AS
SELECT
    COUNT(*) AS total_pagos_culqi,
    AVG(tiempo_confirmacion_seg) AS segundos_promedio_confirmacion,
    CAST(AVG(CAST(tiempo_confirmacion_seg AS DECIMAL(10,2))) / 60.0 AS DECIMAL(5,2)) AS minutos_promedio_confirmacion,
    CASE 
        WHEN (AVG(CAST(tiempo_confirmacion_seg AS DECIMAL(10,2))) / 60.0) <= 10.0 THEN 'VERDE'
        WHEN (AVG(CAST(tiempo_confirmacion_seg AS DECIMAL(10,2))) / 60.0) <= 30.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_COBRANZA
WHERE pago_confirmado = 1 AND tiempo_confirmacion_seg IS NOT NULL;
GO

-- KPI 3.3: Tasa de Recuperación por Alerta de Cobranza (Meta: >= 30%)
CREATE OR ALTER VIEW dbo.vw_kpi_payers_recuperacion_alertas AS
SELECT
    COUNT(*) AS total_pagos_recibidos,
    SUM(CASE WHEN pago_tras_alerta_cobranza = 1 THEN 1 ELSE 0 END) AS pagos_recuperados_por_alerta,
    CAST(SUM(CASE WHEN pago_tras_alerta_cobranza = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_recuperacion_cobranza_pct,
    CASE 
        WHEN (SUM(CASE WHEN pago_tras_alerta_cobranza = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 30.0 THEN 'VERDE'
        WHEN (SUM(CASE WHEN pago_tras_alerta_cobranza = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 15.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_COBRANZA
WHERE pago_confirmado = 1;
GO

-- KPI 3.4: Recaudación Total en Soles por Método y Cuotas
CREATE OR ALTER VIEW dbo.vw_kpi_payers_recaudacion_total AS
SELECT
    ISNULL(mp.metodo, 'OTROS') AS metodo_pago,
    ISNULL(mp.gateway, 'MANUAL') AS pasarela,
    ISNULL(mp.tipo_financiamiento, 'CONTADO') AS modalidad,
    COUNT(*) AS cantidad_transacciones,
    SUM(fc.monto_pagado) AS monto_total_recaudado_pen,
    AVG(fc.monto_pagado) AS ticket_promedio_pen,
    SUM(fc.monto_descuento) AS total_descuentos_otorgados_pen
FROM dbo.FACT_COBRANZA fc
JOIN dbo.DIM_METODO_PAGO mp ON mp.metodo_pago_key = fc.metodo_pago_key
WHERE fc.pago_confirmado = 1
GROUP BY mp.metodo, mp.gateway, mp.tipo_financiamiento;
GO
