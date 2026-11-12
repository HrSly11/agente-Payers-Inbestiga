-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 2: LEADS (Conversión y Negociación con IA)
-- Vistas Analíticas de Indicadores (KPIs) - inbestiga_dm_leads
-- Metodología Ralph Kimball: Esquema Estrella Atómico Separado
-- =============================================================================

USE inbestiga_dm_leads;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- KPI 2.1: Tasa de Conversión de Lead a Payer (Meta: >= 18%)
CREATE OR ALTER VIEW dbo.vw_kpi_leads_conversion AS
SELECT
    COUNT(*) AS total_leads_negociados,
    SUM(CASE WHEN convertido_a_pago = 1 THEN 1 ELSE 0 END) AS total_convertidos_a_pago,
    CAST(SUM(CASE WHEN convertido_a_pago = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_conversion_lead_payer_pct,
    CASE 
        WHEN (SUM(CASE WHEN convertido_a_pago = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 18.0 THEN 'VERDE'
        WHEN (SUM(CASE WHEN convertido_a_pago = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) >= 10.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_NEGOCIACION;
GO

-- KPI 2.2: Tasa de Recuperación de Objeciones (Meta: >= 25%)
CREATE OR ALTER VIEW dbo.vw_kpi_leads_recuperacion_objeciones AS
SELECT
    COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' THEN 1 END) AS total_leads_con_objecion,
    COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' AND f.convertido_a_pago = 1 THEN 1 END) AS objeciones_convertidas_a_pago,
    CAST(COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' AND f.convertido_a_pago = 1 THEN 1.0 END)
         / NULLIF(COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' THEN 1.0 END), 0) * 100 AS DECIMAL(5,2)) AS tasa_recuperacion_objeciones_pct,
    CASE 
        WHEN (COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' AND f.convertido_a_pago = 1 THEN 1.0 END)
              / NULLIF(COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' THEN 1.0 END), 0) * 100) >= 25.0 THEN 'VERDE'
        WHEN (COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' AND f.convertido_a_pago = 1 THEN 1.0 END)
              / NULLIF(COUNT(CASE WHEN o.tipo_objecion IS NOT NULL AND o.tipo_objecion <> 'NINGUNA' THEN 1.0 END), 0) * 100) >= 15.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_NEGOCIACION f
LEFT JOIN dbo.DIM_OBJECION o ON o.objecion_key = f.objecion_key;
GO

-- KPI 2.3: Tiempo Promedio de Cierre de Negociación (Meta: <= 72 horas)
CREATE OR ALTER VIEW dbo.vw_kpi_leads_tiempo_negociacion AS
SELECT
    COUNT(CASE WHEN convertido_a_pago = 1 THEN 1 END) AS ventas_cerradas,
    AVG(tiempo_negociacion_min) AS minutos_promedio_cierre,
    CAST(AVG(CAST(tiempo_negociacion_min AS DECIMAL(10,2))) / 60.0 AS DECIMAL(5,2)) AS horas_promedio_cierre,
    CASE 
        WHEN (AVG(CAST(tiempo_negociacion_min AS DECIMAL(10,2))) / 60.0) <= 72.0 THEN 'VERDE'
        WHEN (AVG(CAST(tiempo_negociacion_min AS DECIMAL(10,2))) / 60.0) <= 120.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_NEGOCIACION
WHERE convertido_a_pago = 1 AND tiempo_negociacion_min IS NOT NULL;
GO

-- KPI 2.4: Tasa de Escalamiento a Asesor Humano (Meta: 15% - 20%)
CREATE OR ALTER VIEW dbo.vw_kpi_leads_escalamiento AS
SELECT
    COUNT(*) AS total_negociaciones_ia,
    SUM(CASE WHEN escalado_a_humano = 1 THEN 1 ELSE 0 END) AS casos_escalados_a_humano,
    CAST(SUM(CASE WHEN escalado_a_humano = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_escalamiento_pct,
    CASE 
        WHEN (SUM(CASE WHEN escalado_a_humano = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) BETWEEN 15.0 AND 20.0 THEN 'VERDE'
        WHEN (SUM(CASE WHEN escalado_a_humano = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100) BETWEEN 10.0 AND 30.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_NEGOCIACION;
GO

-- KPI 2.5: Descuento Promedio Negociado (Meta: <= 10%, Tope: 15%)
CREATE OR ALTER VIEW dbo.vw_kpi_leads_descuento_promedio AS
SELECT
    COUNT(CASE WHEN descuento_aplicado_pct > 0 THEN 1 END) AS propuestas_con_descuento,
    CAST(AVG(descuento_aplicado_pct) AS DECIMAL(5,2)) AS descuento_promedio_otorgado_pct,
    MAX(descuento_aplicado_pct) AS descuento_maximo_registrado_pct,
    CASE 
        WHEN AVG(descuento_aplicado_pct) <= 10.0 THEN 'VERDE'
        WHEN AVG(descuento_aplicado_pct) <= 15.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_NEGOCIACION
WHERE descuento_aplicado_pct > 0;
GO

-- KPI 2.6: Desglose Dimensional por Universidad
CREATE OR ALTER VIEW dbo.vw_kpi_leads_por_universidad AS
SELECT
    ISNULL(u.siglas, 'OTRAS') AS universidad_siglas,
    ISNULL(u.nombre, 'Otras Universidades') AS universidad_nombre,
    COUNT(1) AS total_negociaciones,
    SUM(CASE WHEN f.convertido_a_pago = 1 THEN 1 ELSE 0 END) AS convertidos_a_pago,
    CAST(SUM(CASE WHEN f.convertido_a_pago = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(1), 0) * 100 AS DECIMAL(5,2)) AS tasa_conversion_pct,
    CAST(AVG(f.descuento_aplicado_pct) AS DECIMAL(5,2)) AS descuento_promedio_pct
FROM dbo.FACT_NEGOCIACION f
LEFT JOIN dbo.DIM_UNIVERSIDAD u ON u.universidad_key = f.universidad_key
GROUP BY u.siglas, u.nombre;
GO
