-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 1: Vistas Analíticas de KPIs (inbestiga_dm_buyers)
-- =============================================================================

USE inbestiga_dm_buyers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- KPI 1.1: Tasa de Conversión Buyer -> Lead (Meta: >= 15%)
CREATE OR ALTER VIEW dbo.vw_kpi_buyers_conversion AS
SELECT 
    COUNT(*) AS total_buyers_captados,
    SUM(CASE WHEN es_lead_calificado = 1 THEN 1 ELSE 0 END) AS total_leads_generados,
    CAST(SUM(CASE WHEN es_lead_calificado = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) AS tasa_conversion_buyer_lead_pct,
    CASE 
        WHEN CAST(SUM(CASE WHEN es_lead_calificado = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) >= 15.0 THEN 'VERDE'
        WHEN CAST(SUM(CASE WHEN es_lead_calificado = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) >= 8.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_CAPTACION;
GO

-- KPI 1.2: Costo por Lead (CPL) por Campaña (Meta: <= S/ 8.00)
CREATE OR ALTER VIEW dbo.vw_kpi_buyers_cpl AS
SELECT 
    c.nombre AS campana_nombre,
    c.presupuesto_total AS inversion_marketing,
    COUNT(CASE WHEN f.es_lead_calificado = 1 THEN 1 END) AS leads_generados,
    CAST(c.presupuesto_total / NULLIF(COUNT(CASE WHEN f.es_lead_calificado = 1 THEN 1 END), 0) AS DECIMAL(10,2)) AS costo_por_lead_cpl,
    CASE 
        WHEN c.presupuesto_total / NULLIF(COUNT(CASE WHEN f.es_lead_calificado = 1 THEN 1 END), 0) <= 8.00 THEN 'VERDE'
        WHEN c.presupuesto_total / NULLIF(COUNT(CASE WHEN f.es_lead_calificado = 1 THEN 1 END), 0) <= 12.00 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.DIM_CAMPANA c
LEFT JOIN dbo.FACT_CAPTACION f ON f.campana_key = c.campana_key
GROUP BY c.campana_key, c.nombre, c.presupuesto_total;
GO

-- KPI 1.3: Promedio de Interacciones por Buyer (Meta: >= 4)
CREATE OR ALTER VIEW dbo.vw_kpi_buyers_interacciones AS
SELECT 
    COUNT(*) AS total_buyers,
    SUM(interacciones_acumuladas) AS total_interacciones_acumuladas,
    CAST(AVG(CAST(interacciones_acumuladas AS DECIMAL(10,2))) AS DECIMAL(5,2)) AS promedio_interacciones_por_buyer,
    CASE 
        WHEN AVG(CAST(interacciones_acumuladas AS DECIMAL(10,2))) >= 4.0 THEN 'VERDE'
        WHEN AVG(CAST(interacciones_acumuladas AS DECIMAL(10,2))) >= 2.0 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_CAPTACION;
GO

-- KPI 1.4: Tiempo Promedio de Primera Respuesta del Agente IA (Meta: <= 2 min)
CREATE OR ALTER VIEW dbo.vw_kpi_buyers_tiempo_primera_respuesta AS
SELECT 
    COUNT(CASE WHEN tiempo_primera_respuesta_seg IS NOT NULL THEN 1 END) AS total_contactos_evaluados,
    AVG(tiempo_primera_respuesta_seg) AS segundos_promedio_primera_respuesta,
    CAST(AVG(CAST(tiempo_primera_respuesta_seg AS DECIMAL(10,2))) / 60.0 AS DECIMAL(5,2)) AS minutos_promedio_primera_respuesta,
    CASE 
        WHEN AVG(tiempo_primera_respuesta_seg) <= 120 THEN 'VERDE'
        WHEN AVG(tiempo_primera_respuesta_seg) <= 300 THEN 'AMARILLO'
        ELSE 'ROJO'
    END AS estado_meta
FROM dbo.FACT_CAPTACION
WHERE tiempo_primera_respuesta_seg IS NOT NULL;
GO

-- KPI 1.5: Rendimiento por Canal de Captación
CREATE OR ALTER VIEW dbo.vw_kpi_buyers_por_canal AS
SELECT 
    ISNULL(cn.nombre, 'Canal Desconocido') AS canal_nombre,
    ISNULL(cn.tipo, 'GENERAL') AS canal_tipo,
    COUNT(f.captacion_key) AS total_buyers,
    SUM(CASE WHEN f.es_lead_calificado = 1 THEN 1 ELSE 0 END) AS leads_generados,
    CAST(SUM(CASE WHEN f.es_lead_calificado = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(f.captacion_key), 0) * 100 AS DECIMAL(5,2)) AS tasa_conversion_canal_pct,
    AVG(f.lead_score) AS lead_score_promedio
FROM dbo.FACT_CAPTACION f
LEFT JOIN dbo.DIM_CANAL cn ON cn.canal_key = f.canal_key
GROUP BY cn.canal_key, cn.nombre, cn.tipo;
GO
